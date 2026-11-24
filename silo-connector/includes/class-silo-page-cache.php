<?php
/**
 * Page cache, write side: decides which WooCommerce responses are stored, writes
 * them atomically, and purges by URL (every query/device/currency/language variant).
 *
 * Only catalog traffic is cached: product pages, the shop page and product
 * taxonomy archives (plus the front page if the merchant opts in).
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.WP.AlternativeFunctions

/**
 * Write, purge and inspect cached pages.
 */
class Silo_Page_Cache {

	/**
	 * Context of the response being rendered (scope, ttl, location, flags).
	 *
	 * @var array|null
	 */
	private static $current = null;

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return;
		}
		add_action( 'template_redirect', array( __CLASS__, 'maybe_start' ), 999 );
	}

	/**
	 * Late serve mode: the drop-in did not run (another plugin owns it, or WP_CACHE is off).
	 */
	public static function late_serve(): void {
		if ( isset( $GLOBALS['silo_request'] ) || is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return;
		}
		require_once SILO_DIR . 'includes/serve.php';
		silo_serve_request( 'late' );
	}

	/**
	 * Decide whether this response belongs in the cache and start buffering it.
	 */
	public static function maybe_start(): void {
		$request = $GLOBALS['silo_request'] ?? null;
		if ( ! is_array( $request ) || empty( $request['config'] ) || ! empty( $request['excluded'] ) ) {
			return;
		}

		$context = self::page_context( (array) $request['config'] );
		if ( null === $context ) {
			return;
		}

		if ( ! empty( $request['bypass'] ) ) {
			Silo_Stats::bump(
				array(
					'bypass' => 1,
					'bypass_' . sanitize_key( (string) $request['bypass'] ) => 1,
				)
			);
			if ( ! headers_sent() ) {
				header( 'X-Silo-Cache: BYPASS' );
				header( 'X-Silo-Bypass: ' . sanitize_key( (string) $request['bypass'] ) );
			}
			return;
		}

		if ( ! empty( $request['uncacheable'] ) || is_user_logged_in() || ( 'GET' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			return;
		}

		$location = $request['location'] ?? silo_request_location( (array) $request['config'] );
		if ( ! is_array( $location ) ) {
			return;
		}

		self::$current = array_merge(
			$context,
			array(
				'location' => $location,
				'warmup'   => ! empty( $request['warmup'] ),
			)
		);

		if ( ! headers_sent() ) {
			header( 'X-Silo-Cache: ' . ( self::$current['warmup'] ? 'WARM' : 'MISS' ) );
			header( 'X-Silo-Scope: ' . $context['scope'] );
		}

		ob_start( array( __CLASS__, 'buffer_callback' ) );
	}

	/**
	 * Scope and TTL for cacheable WooCommerce pages, or null for everything else.
	 *
	 * @param array $config Config.
	 */
	private static function page_context( array $config ): ?array {
		if ( is_search() || is_404() || is_preview() || is_feed() || is_customize_preview() || post_password_required() ) {
			return null;
		}
		if ( function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url() ) {
			return null;
		}

		$ttl = (array) ( $config['ttl'] ?? array() );

		if ( function_exists( 'is_product' ) && is_product() ) {
			return array(
				'type'  => 'product',
				'scope' => 'product:' . get_queried_object_id(),
				'ttl'   => (int) ( $ttl['product'] ?? 3600 ),
			);
		}
		if ( function_exists( 'is_shop' ) && is_shop() ) {
			return array(
				'type'  => 'shop',
				'scope' => 'shop',
				'ttl'   => (int) ( $ttl['shop'] ?? 1800 ),
			);
		}
		if ( function_exists( 'is_product_taxonomy' ) && is_product_taxonomy() ) {
			$term = get_queried_object();
			return array(
				'type'  => 'archive',
				'scope' => 'archive:' . ( $term instanceof WP_Term ? $term->taxonomy . ':' . $term->term_id : 'unknown' ),
				'ttl'   => (int) ( $ttl['category'] ?? 1800 ),
			);
		}
		if ( ! empty( $config['front_page'] ) && is_front_page() ) {
			return array(
				'type'  => 'front',
				'scope' => 'front',
				'ttl'   => (int) ( $ttl['shop'] ?? 1800 ),
			);
		}
		return null;
	}

	/**
	 * Output buffer callback: store the finished page, then pass it through unchanged.
	 *
	 * @param string $buffer Rendered output.
	 * @param int    $phase  Output handler phase flags.
	 */
	public static function buffer_callback( $buffer, $phase ) {
		$context = self::$current;
		if ( null === $context || ! ( $phase & PHP_OUTPUT_HANDLER_FINAL ) || ( $phase & PHP_OUTPUT_HANDLER_CLEAN ) ) {
			if ( null !== $context ) {
				self::$current = null; // Partial flush or discarded output: never store it.
			}
			return $buffer;
		}
		self::$current = null;

		if ( ! self::should_store( (string) $buffer ) ) {
			return $buffer;
		}

		$location = $context['location'];
		$started  = (float) ( $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime( true ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
		if ( silo_last_purge( $location['site'], $location['dir'] ) >= $started ) {
			return $buffer; // A purge landed while this page was rendering; its data may be stale.
		}
		$base = $location['file'];
		$dir  = dirname( $base ) . '/';
		if ( ! wp_mkdir_p( $dir ) ) {
			return $buffer;
		}

		$html = (string) $buffer . "\n<!-- Cached by Silo for WooCommerce · " . gmdate( 'Y-m-d H:i:s' ) . ' UTC · ' . esc_html( $context['scope'] ) . " -->\n";
		$meta = array(
			'url'          => $location['url'],
			'query'        => $location['query'],
			'device'       => $location['device'],
			'currency'     => $location['currency'],
			'language'     => $location['language'],
			'country'      => $location['country'] ?? '',
			'type'         => $context['type'],
			'scope'        => $context['scope'],
			'ttl'          => max( 60, (int) $context['ttl'] ),
			'created'      => time(),
			'render_ms'    => silo_elapsed_ms(),
			'bytes'        => strlen( $html ),
			'content_type' => 'text/html; charset=' . get_option( 'blog_charset', 'UTF-8' ),
		);

		$suffix = '.' . wp_generate_password( 6, false, false );
		if ( false !== file_put_contents( $base . '.html' . $suffix, $html ) && false !== file_put_contents( $base . '.json' . $suffix, (string) wp_json_encode( $meta ) ) ) {
			rename( $base . '.html' . $suffix, $base . '.html' );
			rename( $base . '.json' . $suffix, $base . '.json' );
		} else {
			@unlink( $base . '.html' . $suffix ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			@unlink( $base . '.json' . $suffix ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
			return $buffer;
		}
		if ( is_file( $base . '.rq' ) ) {
			@unlink( $base . '.rq' ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}

		if ( ! $context['warmup'] ) {
			Silo_Stats::bump(
				array(
					'misses'                   => 1,
					'miss_ms'                  => $meta['render_ms'],
					'miss_n'                   => 1,
					'miss_' . $context['type'] => 1,
				)
			);
		}
		delete_transient( 'silo_inventory' );

		return $buffer;
	}

	/**
	 * Final safety checks on the rendered response.
	 *
	 * @param string $buffer Buffer.
	 */
	private static function should_store( string $buffer ): bool {
		if ( 200 !== http_response_code() || strlen( $buffer ) < 255 || ( defined( 'DONOTCACHEPAGE' ) && DONOTCACHEPAGE ) ) {
			return false;
		}
		if ( false === stripos( $buffer, '</html>' ) ) {
			return false;
		}
		foreach ( headers_list() as $header ) {
			$lower = strtolower( $header );
			if ( str_starts_with( $lower, 'set-cookie:' ) ) {
				return false; // The page personalised itself for this visitor.
			}
			if ( str_starts_with( $lower, 'content-type:' ) && ! str_contains( $lower, 'text/html' ) ) {
				return false;
			}
			if ( str_starts_with( $lower, 'cache-control:' ) && ( str_contains( $lower, 'no-store' ) || str_contains( $lower, 'private' ) ) ) {
				return false; // The page asked not to be shared.
			}
			if ( str_starts_with( $lower, 'content-encoding:' ) ) {
				return false;
			}
		}
		if ( function_exists( 'wc_notice_count' ) && function_exists( 'WC' ) && WC()->session && wc_notice_count() > 0 ) {
			return false;
		}
		return true;
	}

	/**
	 * Remove every cached variant of a URL, and its paginated children.
	 *
	 * @param string $url URL.
	 */
	public static function purge_url( string $url ): int {
		$parts = wp_parse_url( $url );
		if ( ! is_array( $parts ) ) {
			return 0;
		}
		$host = isset( $parts['host'] ) ? $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' ) : Silo_Settings::site_host();
		if ( silo_host_key( $host ) !== silo_host_key( Silo_Settings::site_host() ) ) {
			return 0; // Only this site's own cache can be purged.
		}
		$dir = silo_path_dir( silo_site_dir( $host ), (string) ( $parts['path'] ?? '/' ) );
		if ( null === $dir ) {
			return 0;
		}

		self::mark_purged( rtrim( $dir, '/' ) . '.purged' );
		$count = self::delete_tree( $dir . '@silo/' );
		if ( is_dir( $dir . 'page/' ) ) {
			$count += self::delete_tree( $dir . 'page/' );
		}
		return $count;
	}

	/**
	 * Purge URLs.
	 *
	 * @param string[] $urls URLs to purge.
	 * @return array{pages:int,urls:int}
	 */
	public static function purge_urls( array $urls ): array {
		$pages = 0;
		$urls  = array_values( array_unique( array_filter( array_map( 'strval', $urls ) ) ) );
		foreach ( $urls as $url ) {
			$pages += self::purge_url( $url );
		}
		if ( $pages > 0 ) {
			delete_transient( 'silo_inventory' );
		}
		// Same URLs in every other layer: another page cache, host cache, Cloudflare.
		Silo_Compat::purge_urls( $urls );
		return array(
			'pages' => $pages,
			'urls'  => count( $urls ),
		);
	}

	/**
	 * Record when a path (or the whole site) was purged; renders that began earlier are discarded.
	 *
	 * @param string $marker Marker.
	 */
	private static function mark_purged( string $marker ): void {
		if ( wp_mkdir_p( dirname( $marker ) ) ) {
			file_put_contents( $marker, (string) microtime( true ) );
		}
	}

	/**
	 * Drop all cached pages and Store API entries for this site.
	 *
	 * @param bool $reset_stats Reset stats.
	 */
	public static function purge_everything( bool $reset_stats ): int {
		$site  = Silo_Settings::site_dir();
		$count = self::delete_tree( $site . 'pages/' ) + self::delete_tree( $site . 'api/' );
		self::mark_purged( $site . 'purged-all' );
		Silo_Fragments::flush();
		if ( is_file( $site . 'refresh.queue' ) ) {
			wp_delete_file( $site . 'refresh.queue' );
		}
		if ( $reset_stats ) {
			Silo_Stats::reset();
		}
		delete_transient( 'silo_inventory' );
		Silo_Compat::purge_all();
		return $count;
	}

	/**
	 * Recursively delete a directory. Returns how many cached pages/entries were removed.
	 *
	 * @param string $dir Dir.
	 */
	public static function delete_tree( string $dir ): int {
		if ( ! is_dir( $dir ) ) {
			return 0;
		}
		$root = silo_cache_root();
		if ( ! str_starts_with( str_replace( '\\', '/', $dir ), $root ) ) {
			return 0; // Never delete outside the Silo cache root.
		}

		$count    = 0;
		$is_api   = str_ends_with( rtrim( str_replace( '\\', '/', $dir ), '/' ), '/api' );
		$iterator = new RecursiveIteratorIterator(
			new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
			RecursiveIteratorIterator::CHILD_FIRST
		);
		foreach ( $iterator as $item ) {
			if ( $item->isDir() ) {
				@rmdir( $item->getPathname() ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
				continue;
			}
			$extension = $item->getExtension();
			if ( 'html' === $extension || ( $is_api && 'json' === $extension ) ) {
				++$count;
			}
			@unlink( $item->getPathname() ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		}
		@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
		return $count;
	}

	/**
	 * Cached pages, bytes and Store API entries (recounted at most every 30 seconds).
	 *
	 * @param bool $fresh Fresh.
	 */
	public static function inventory( bool $fresh = false ): array {
		$cached = $fresh ? false : get_transient( 'silo_inventory' );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$site      = Silo_Settings::site_dir();
		$inventory = array(
			'pages'   => 0,
			'bytes'   => 0,
			'api'     => 0,
			'product' => 0,
			'archive' => 0,
			'shop'    => 0,
		);

		if ( is_dir( $site . 'pages/' ) ) {
			$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $site . 'pages/', FilesystemIterator::SKIP_DOTS ) );
			foreach ( $iterator as $item ) {
				if ( 'html' === $item->getExtension() ) {
					++$inventory['pages'];
					$inventory['bytes'] += (int) $item->getSize();
				}
			}
		}
		if ( is_dir( $site . 'api/' ) ) {
			$entries          = glob( $site . 'api/*.json' );
			$inventory['api'] = is_array( $entries ) ? count( $entries ) : 0;
		}

		set_transient( 'silo_inventory', $inventory, 30 );
		return $inventory;
	}

	/**
	 * Cached entries with freshness, for the cache inspector.
	 *
	 * @param int $limit Limit.
	 */
	public static function entries( int $limit = 200 ): array {
		$site = Silo_Settings::site_dir();
		$list = array();
		if ( ! is_dir( $site . 'pages/' ) ) {
			return $list;
		}

		$iterator = new RecursiveIteratorIterator( new RecursiveDirectoryIterator( $site . 'pages/', FilesystemIterator::SKIP_DOTS ) );
		$now      = time();
		foreach ( $iterator as $item ) {
			if ( 'json' !== $item->getExtension() || ! str_contains( str_replace( '\\', '/', $item->getPath() ), '/@silo' ) ) {
				continue;
			}
			$meta = json_decode( (string) file_get_contents( $item->getPathname() ), true );
			if ( ! is_array( $meta ) || empty( $meta['url'] ) ) {
				continue;
			}
			$age    = $now - (int) $meta['created'];
			$ttl    = (int) ( $meta['ttl'] ?? 3600 );
			$list[] = array(
				'url'       => (string) $meta['url'],
				'type'      => (string) ( $meta['type'] ?? '' ),
				'scope'     => (string) ( $meta['scope'] ?? '' ),
				'device'    => (string) ( $meta['device'] ?? 'desktop' ),
				'currency'  => (string) ( $meta['currency'] ?? '' ),
				'language'  => (string) ( $meta['language'] ?? '' ),
				'age'       => $age,
				'ttl'       => $ttl,
				'fresh'     => $age <= $ttl,
				'size'      => (int) ( $meta['bytes'] ?? 0 ),
				'render_ms' => (int) ( $meta['render_ms'] ?? 0 ),
			);
		}

		usort(
			$list,
			static function ( $a, $b ) {
				return $a['age'] <=> $b['age'];
			}
		);
		return array_slice( $list, 0, $limit );
	}

	/**
	 * Move stale entries flagged by the drop-in into the warmup queue.
	 */
	public static function drain_refresh_queue(): void {
		$file = Silo_Settings::site_dir() . 'refresh.queue';
		if ( ! is_file( $file ) ) {
			return;
		}
		$work = $file . '.' . wp_generate_password( 6, false, false );
		if ( ! @rename( $file, $work ) ) { // phpcs:ignore WordPress.PHP.NoSilencedErrors
			return;
		}
		$urls = array_values( array_unique( array_filter( array_map( 'trim', (array) file( $work ) ) ) ) );
		wp_delete_file( $work );
		if ( $urls ) {
			Silo_Warmup::enqueue( array_slice( $urls, 0, 200 ), 'refresh', 'refresh' );
		}
	}
}
