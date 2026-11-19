<?php
/**
 * Cache addressing shared by the advanced-cache drop-in and the plugin.
 *
 * This file runs before WordPress is loaded, so it uses plain PHP only.
 * Both the reader (drop-in) and the writer (plugin) resolve locations through
 * these functions, which guarantees they always agree on cache keys.
 *
 * Layout: wp-content/cache/silo/{host}/pages/{path segments}/@silo/{variant}.html|.json
 * Purging a URL removes every variant (query, device, currency, language) in one directory.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.Security.ValidatedSanitizedInput, WordPress.WP.AlternativeFunctions, WordPress.PHP.NoSilencedErrors

if ( ! function_exists( 'silo_cache_root' ) ) {

	/**
	 * Root directory for everything Silo writes to disk.
	 */
	function silo_cache_root(): string {
		return rtrim( str_replace( '\\', '/', WP_CONTENT_DIR ), '/' ) . '/cache/silo/';
	}

	/**
	 * Filesystem-safe form of a host (with optional port).
	 *
	 * @param string $host Host.
	 */
	function silo_host_key( string $host ): string {
		$host = strtolower( trim( $host ) );
		$host = (string) preg_replace( '/[^a-z0-9.\-:\[\]]/', '', $host );
		return str_replace( array( ':', '[', ']' ), array( '_', '', '' ), $host );
	}

	/**
	 * Per-site directory holding pages, Store API entries, stats and the edge config.
	 *
	 * @param string $host Host.
	 */
	function silo_site_dir( string $host ): string {
		return silo_cache_root() . silo_host_key( $host ) . '/';
	}

	/**
	 * Tracking parameters never change the rendered page; they are dropped from the key.
	 *
	 * @param string $key Key.
	 */
	function silo_is_tracking_param( string $key ): bool {
		return 1 === preg_match( '/^(utm_[a-z0-9_]+|gclid|gbraid|wbraid|fbclid|msclkid|mc_cid|mc_eid|_ga|_gl|srsltid|ttclid|twclid|yclid|igshid|dclid|_ke|mkt_tok)$/i', $key );
	}

	/**
	 * Catalog parameters that produce a distinct, shareable storefront response.
	 *
	 * @param string $key Key.
	 */
	function silo_is_catalog_param( string $key ): bool {
		return 1 === preg_match( '/^(orderby|paged|product-page|min_price|max_price|rating_filter|v|filter_[a-z0-9_\-]+|query_type_[a-z0-9_\-]+)$/i', $key );
	}

	/**
	 * Normalised query used in the cache key, or null when the query makes the request uncacheable.
	 *
	 * Unknown parameters (search, add-to-cart, wc-ajax, nonces, previews) are never cached.
	 *
	 * @param string $query Query.
	 */
	function silo_normalize_query( string $query ): ?string {
		if ( '' === $query ) {
			return '';
		}

		$params = array();
		parse_str( $query, $params );
		$keep = array();

		foreach ( $params as $key => $value ) {
			$key = (string) $key;
			if ( silo_is_tracking_param( $key ) || 'currency' === $key || 'lang' === $key ) {
				continue;
			}
			if ( is_array( $value ) || ! silo_is_catalog_param( $key ) ) {
				return null;
			}
			$keep[ strtolower( $key ) ] = (string) $value;
		}

		ksort( $keep );
		return http_build_query( $keep );
	}

	/**
	 * Device class used as a cache variant (themes may render differently via wp_is_mobile()).
	 *
	 * @param string $user_agent User agent.
	 */
	function silo_request_device( string $user_agent ): string {
		return preg_match( '/Mobile|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i', $user_agent ) ? 'mobile' : 'desktop';
	}

	/**
	 * Short token safe for keys and headers.
	 *
	 * @param string $value Value.
	 */
	function silo_token( string $value ): string {
		return substr( (string) preg_replace( '/[^A-Za-z0-9_\-]/', '', $value ), 0, 16 );
	}

	/**
	 * Active currency from the query string or the cookies set by common multi-currency plugins.
	 *
	 * @param array $get Get.
	 * @param array $cookie Cookie.
	 */
	function silo_request_currency( array $get, array $cookie ): string {
		if ( isset( $get['currency'] ) && is_string( $get['currency'] ) ) {
			return silo_token( $get['currency'] );
		}
		$cookies = array( 'wcml_client_currency', 'woocs_current_currency', 'wmc_current_currency', 'aelia_cs_selected_currency', 'yay_currency_widget', 'yay_currency', 'woocommerce_multicurrency_forced_currency', 'woocommerce_multicurrency_for_woo_currency', 'wcpay_currency' );
		foreach ( $cookies as $name ) {
			if ( ! empty( $cookie[ $name ] ) && is_string( $cookie[ $name ] ) ) {
				return silo_token( $cookie[ $name ] );
			}
		}
		return '';
	}

	/**
	 * Active language for stores that switch language by cookie or query (not by path/domain).
	 *
	 * @param array $get Get.
	 * @param array $cookie Cookie.
	 */
	function silo_request_language( array $get, array $cookie ): string {
		if ( isset( $get['lang'] ) && is_string( $get['lang'] ) ) {
			return silo_token( $get['lang'] );
		}
		foreach ( array( 'wp-wpml_current_language', 'pll_language', 'trp_language', 'weglot_language' ) as $name ) {
			if ( ! empty( $cookie[ $name ] ) && is_string( $cookie[ $name ] ) ) {
				return silo_token( $cookie[ $name ] );
			}
		}
		return '';
	}

	/**
	 * Visitor country from the CDN or proxy, for stores that geolocate prices server-side.
	 * Returns null when the store needs a country but none is available (do not cache).
	 *
	 * @param array $server Server.
	 */
	function silo_request_country( array $server ): ?string {
		foreach ( array( 'HTTP_CF_IPCOUNTRY', 'HTTP_X_COUNTRY_CODE', 'HTTP_CLOUDFRONT_VIEWER_COUNTRY', 'HTTP_X_GEOIP_COUNTRY', 'HTTP_X_APPENGINE_COUNTRY', 'GEOIP_COUNTRY_CODE', 'HTTP_X_VERCEL_IP_COUNTRY' ) as $key ) {
			if ( ! empty( $server[ $key ] ) && is_string( $server[ $key ] ) && preg_match( '/^[A-Za-z]{2}$/', $server[ $key ] ) ) {
				return strtoupper( $server[ $key ] );
			}
		}
		return null;
	}

	/**
	 * Directory for a URL path. Returns null for paths that can never be cached safely.
	 *
	 * @param string $site_dir Site dir.
	 * @param string $path Path.
	 */
	function silo_path_dir( string $site_dir, string $path ): ?string {
		$path = rawurldecode( $path );
		if ( str_contains( $path, "\0" ) ) {
			return null;
		}

		$parts = array();
		foreach ( explode( '/', $path ) as $segment ) {
			if ( '' === $segment ) {
				continue;
			}
			if ( '.' === $segment || '..' === $segment ) {
				return null;
			}
			$segment = rawurlencode( $segment );
			if ( strlen( $segment ) > 150 ) {
				$segment = substr( $segment, 0, 100 ) . '~' . md5( $segment );
			}
			$parts[] = $segment;
		}

		if ( count( $parts ) > 16 ) {
			return null;
		}

		return $site_dir . 'pages/' . ( $parts ? implode( '/', $parts ) . '/' : '' );
	}

	/**
	 * Request-dependent part of the key.
	 *
	 * @param string $query Query.
	 * @param string $device Device.
	 * @param string $currency Currency.
	 * @param string $language Language.
	 * @param string $scheme Scheme.
	 * @param string $country Country.
	 */
	function silo_variant_id( string $query, string $device, string $currency, string $language, string $scheme = 'https', string $country = '' ): string {
		return md5( $query . '|' . $device . '|' . $currency . '|' . $language . '|' . $scheme . '|' . $country );
	}

	/**
	 * Request scheme, honouring the usual reverse-proxy headers.
	 *
	 * @param array $server Server.
	 */
	function silo_request_scheme( array $server ): string {
		if ( ( ! empty( $server['HTTPS'] ) && 'off' !== strtolower( (string) $server['HTTPS'] ) ) || 443 === (int) ( $server['SERVER_PORT'] ?? 0 ) ) {
			return 'https';
		}
		if ( 'https' === strtolower( (string) ( $server['HTTP_X_FORWARDED_PROTO'] ?? '' ) ) || 'on' === strtolower( (string) ( $server['HTTP_X_FORWARDED_SSL'] ?? '' ) ) ) {
			return 'https';
		}
		return 'http';
	}

	/**
	 * Full cache location for the current request, or null if it is not addressable.
	 *
	 * @param array $config Config.
	 * @return array{site:string,dir:string,file:string,query:string,device:string,currency:string,language:string,url:string}|null
	 */
	function silo_request_location( array $config ): ?array {
		$host = (string) ( $_SERVER['HTTP_HOST'] ?? '' );
		$uri  = (string) ( $_SERVER['REQUEST_URI'] ?? '/' );
		if ( '' === $host ) {
			return null;
		}

		$pieces = explode( '?', $uri, 2 );
		$query  = silo_normalize_query( $pieces[1] ?? '' );
		if ( null === $query ) {
			return null;
		}

		$site = silo_site_dir( $host );
		$dir  = silo_path_dir( $site, $pieces[0] );
		if ( null === $dir ) {
			return null;
		}

		$variants = (array) ( $config['variants'] ?? array() );
		$device   = silo_request_device( (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) );
		$currency = ! empty( $variants['currency'] ) ? silo_request_currency( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only storefront variant (currency), sanitised by silo_token().
		$language = ! empty( $variants['language_cookie'] ) ? silo_request_language( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only storefront variant (language), sanitised by silo_token().
		$scheme   = silo_request_scheme( $_SERVER );
		$country  = '';
		if ( ! empty( $variants['country'] ) ) {
			$country = (string) silo_request_country( $_SERVER );
			if ( '' === $country ) {
				return null; // Prices depend on the visitor's country and we cannot tell it.
			}
		}

		return array(
			'site'     => $site,
			'dir'      => $dir,
			'file'     => $dir . '@silo/' . silo_variant_id( $query, $device, $currency, $language, $scheme, $country ),
			'query'    => $query,
			'device'   => $device,
			'currency' => $currency,
			'language' => $language,
			'country'  => $country,
			'scheme'   => $scheme,
			'url'      => $scheme . '://' . $host . $pieces[0] . ( '' !== $query ? '?' . $query : '' ),
		);
	}

	/**
	 * Edge config written by the plugin (enabled flag, variants, exclusions, TTLs, warm token).
	 *
	 * @param string $site_dir Site dir.
	 */
	function silo_load_site_config( string $site_dir ): ?array {
		static $loaded = array();
		if ( array_key_exists( $site_dir, $loaded ) ) {
			return $loaded[ $site_dir ];
		}
		$file   = $site_dir . 'config.json';
		$config = is_readable( $file ) ? json_decode( (string) @file_get_contents( $file ), true ) : null;

		$loaded[ $site_dir ] = is_array( $config ) ? $config : null;
		return $loaded[ $site_dir ];
	}

	/**
	 * Paths that are never served from or written to the shared cache.
	 *
	 * @param string $path Path.
	 * @param array  $config Config.
	 */
	function silo_path_excluded( string $path, array $config ): bool {
		$normalized = '/' . ltrim( strtolower( rawurldecode( $path ) ), '/' );

		if ( preg_match( '#/(wp-admin|wp-includes|wp-json|wp-content)(/|$)|/wp-[a-z\-]+\.php|/xmlrpc\.php|\.php$|/feed/?$|/embed/?$|/trackback/?$|\.(xml|txt|json|ico)$|/sitemap#', $normalized ) ) {
			return true;
		}

		foreach ( (array) ( $config['exclude_paths'] ?? array() ) as $excluded ) {
			$excluded = '/' . trim( strtolower( (string) $excluded ), '/' );
			if ( '/' === $excluded ) {
				continue;
			}
			if ( $normalized === $excluded || $normalized === $excluded . '/' || str_starts_with( $normalized, $excluded . '/' ) ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Why a request must not touch the shared cache. Empty string means it may.
	 *
	 * @param array $cookie Cookie.
	 * @param array $server Server.
	 */
	function silo_session_bypass_reason( array $cookie, array $server ): string {
		if ( ! empty( $server['HTTP_AUTHORIZATION'] ) || ! empty( $server['PHP_AUTH_USER'] ) ) {
			return 'authorization';
		}
		foreach ( array_keys( $cookie ) as $name ) {
			$name = (string) $name;
			if ( str_starts_with( $name, 'wordpress_logged_in_' ) ) {
				return 'logged_in';
			}
			if ( str_starts_with( $name, 'wp_woocommerce_session_' ) ) {
				return 'session';
			}
			if ( 'woocommerce_items_in_cart' === $name || 'woocommerce_cart_hash' === $name || 'store_api_cart_hash' === $name ) {
				return 'cart';
			}
			if ( str_starts_with( $name, 'wp-postpass_' ) ) {
				return 'password';
			}
			if ( str_starts_with( $name, 'comment_author_' ) ) {
				return 'commenter';
			}
		}
		return '';
	}

	/**
	 * Fresh statistics record. A new epoch tells Silo the counters were reset.
	 */
	function silo_stats_blank(): array {
		return array(
			'epoch'      => bin2hex( random_bytes( 6 ) ),
			'since'      => time(),
			'hits'       => 0,
			'misses'     => 0,
			'stale'      => 0,
			'bypass'     => 0,
			'hit_ms'     => 0,
			'hit_n'      => 0,
			'miss_ms'    => 0,
			'miss_n'     => 0,
			'api_hits'   => 0,
			'api_misses' => 0,
			'updated'    => time(),
		);
	}

	/**
	 * Atomically increment counters in the site stats file (exclusive lock, read-modify-write).
	 *
	 * @param string $site_dir Site dir.
	 * @param array  $increments Increments.
	 */
	function silo_stats_bump( string $site_dir, array $increments ): void {
		if ( ! is_dir( $site_dir ) ) {
			return;
		}
		$handle = @fopen( $site_dir . 'stats.json', 'c+' );
		if ( ! $handle ) {
			return;
		}
		if ( flock( $handle, LOCK_EX ) ) {
			$raw   = stream_get_contents( $handle );
			$stats = $raw ? json_decode( $raw, true ) : null;
			if ( ! is_array( $stats ) || empty( $stats['epoch'] ) ) {
				$stats = silo_stats_blank();
			}
			foreach ( $increments as $key => $value ) {
				$stats[ $key ] = (int) ( $stats[ $key ] ?? 0 ) + (int) $value;
			}
			$stats['updated'] = time();
			ftruncate( $handle, 0 );
			rewind( $handle );
			fwrite( $handle, (string) json_encode( $stats ) );
			fflush( $handle );
			flock( $handle, LOCK_UN );
		}
		fclose( $handle );
	}

	/**
	 * Milliseconds since the request started.
	 */
	function silo_elapsed_ms(): int {
		$start = (float) ( $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime( true ) );
		return max( 0, (int) round( ( microtime( true ) - $start ) * 1000 ) );
	}

	/**
	 * Time of the most recent purge that covers a page directory (its own path or the whole site).
	 * A page that started rendering before that moment must not be written: it may hold stale stock.
	 *
	 * @param string $site_dir Site dir.
	 * @param string $page_dir Page dir.
	 */
	function silo_last_purge( string $site_dir, string $page_dir ): float {
		$times = array();
		foreach ( array( $site_dir . 'purged-all', rtrim( $page_dir, '/' ) . '.purged' ) as $marker ) {
			if ( is_file( $marker ) ) {
				$times[] = (float) @file_get_contents( $marker );
			}
		}
		return $times ? max( $times ) : 0.0;
	}

	/**
	 * Ask the connector to re-render a stale entry in the background (deduplicated per entry).
	 *
	 * @param string $site_dir Site dir.
	 * @param string $file_base File base.
	 * @param string $url URL.
	 */
	function silo_queue_refresh( string $site_dir, string $file_base, string $url ): void {
		if ( '' === $url || is_file( $file_base . '.rq' ) ) {
			return;
		}
		@touch( $file_base . '.rq' );
		@file_put_contents( $site_dir . 'refresh.queue', $url . "\n", FILE_APPEND | LOCK_EX );
	}
}
