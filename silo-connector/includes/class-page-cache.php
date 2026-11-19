<?php
/**
 * Page cache: writing cached pages, managing stats, purging.
 * The serve-from-disk path lives in advanced-cache.php (drop-in).
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Page_Cache {

	private static ?self $instance = null;
	private bool $should_cache     = false;
	private string $cache_dir;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->cache_dir = SILO_CACHE_DIR;
		add_action( 'init', array( $this, 'register_cache_hooks' ), 1 );
	}

	public function register_cache_hooks(): void {
		if ( silo()->is_configured() && get_option( 'silo_cache_enabled', '1' ) === '1' ) {
			add_action( 'template_redirect', array( $this, 'maybe_start_buffer' ), -1 );
			add_action( 'shutdown', array( $this, 'maybe_write_cache' ), 0 );
		}
	}

	public function maybe_start_buffer(): void {
		if ( ! $this->is_cacheable() ) {
			return;
		}
		$this->should_cache = true;
		ob_start();
	}

	public function maybe_write_cache(): void {
		if ( ! $this->should_cache ) {
			return;
		}

		$html = ob_get_clean();
		if ( empty( $html ) || strlen( $html ) < 100 ) {
			echo $html; // phpcs:ignore WordPress.Security.EscapeOutput
			return;
		}

		if ( http_response_code() !== 200 ) {
			echo $html; // phpcs:ignore
			return;
		}

		$url       = $this->get_current_url();
		$device    = $this->detect_device();
		$currency  = $this->detect_currency();
		$language  = $this->detect_language();
		$cache_key = md5( $url . '|' . $device . '|' . $currency . '|' . $language );
		$subdir    = $this->cache_dir . substr( $cache_key, 0, 2 ) . '/';

		if ( ! is_dir( $subdir ) ) {
			wp_mkdir_p( $subdir );
		}

		$config = get_option( 'silo_config', array() );
		$ttl    = $this->resolve_ttl( $config );

		$meta = array(
			'url'          => $url,
			'device'       => $device,
			'currency'     => $currency,
			'language'     => $language,
			'created'      => time(),
			'ttl'          => $ttl,
			'status'       => 200,
			'content_type' => 'text/html; charset=UTF-8',
		);

		file_put_contents( $subdir . $cache_key . '.html', $html, LOCK_EX ); // phpcs:ignore
		file_put_contents( $subdir . $cache_key . '.json', wp_json_encode( $meta ), LOCK_EX ); // phpcs:ignore

		header( 'X-Silo-Cache: MISS' );
		header( 'X-Silo-Key: ' . $cache_key );
		echo $html; // phpcs:ignore
	}

	private function is_cacheable(): bool {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
			return false;
		}
		if ( 'GET' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
			return false;
		}
		if ( ! empty( $_POST ) ) { // phpcs:ignore
			return false;
		}
		if ( is_user_logged_in() ) {
			return false;
		}
		if ( defined( 'DONOTCACHEPAGE' ) && DONOTCACHEPAGE ) {
			return false;
		}

		if ( function_exists( 'is_cart' ) && is_cart() ) {
			return false;
		}
		if ( function_exists( 'is_checkout' ) && is_checkout() ) {
			return false;
		}
		if ( function_exists( 'is_account_page' ) && is_account_page() ) {
			return false;
		}

		$config     = get_option( 'silo_config', array() );
		$exclusions = $config['exclusions'] ?? array();
		$uri        = sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ?? '' ) );

		foreach ( $exclusions as $pattern ) {
			if ( str_starts_with( $pattern, 'query:' ) ) {
				$param = substr( $pattern, 6 );
				if ( isset( $_GET[ $param ] ) ) { // phpcs:ignore
					return false;
				}
			} elseif ( 'logged_in_with_cart' === $pattern ) {
				continue;
			} elseif ( str_contains( $uri, $pattern ) ) {
				return false;
			}
		}

		return true;
	}

	private function resolve_ttl( array $config ): int {
		$ttl = $config['ttl'] ?? array();

		if ( function_exists( 'is_product' ) && is_product() ) {
			return $ttl['product'] ?? 3600;
		}
		if ( function_exists( 'is_product_category' ) && is_product_category() ) {
			return $ttl['category'] ?? 1800;
		}
		if ( function_exists( 'is_product_tag' ) && is_product_tag() ) {
			return $ttl['category'] ?? 1800;
		}
		if ( function_exists( 'is_shop' ) && is_shop() ) {
			return $ttl['shop'] ?? 1800;
		}

		return $ttl['product'] ?? 3600;
	}

	private function get_current_url(): string {
		$scheme = is_ssl() ? 'https' : 'http';
		return $scheme . '://' . ( $_SERVER['HTTP_HOST'] ?? 'localhost' ) . ( $_SERVER['REQUEST_URI'] ?? '/' );
	}

	private function detect_device(): string {
		$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
		if ( preg_match( '/Mobile|Android.*Mobile|iPhone|iPod/i', $ua ) ) {
			return 'mobile';
		}
		return 'desktop';
	}

	private function detect_currency(): string {
		if ( isset( $_GET['currency'] ) ) { // phpcs:ignore
			return sanitize_text_field( wp_unslash( $_GET['currency'] ) ); // phpcs:ignore
		}
		if ( isset( $_COOKIE['wcml_client_currency'] ) ) {
			return sanitize_text_field( wp_unslash( $_COOKIE['wcml_client_currency'] ) );
		}
		if ( isset( $_COOKIE['woocs_current_currency'] ) ) {
			return sanitize_text_field( wp_unslash( $_COOKIE['woocs_current_currency'] ) );
		}
		return 'default';
	}

	private function detect_language(): string {
		if ( defined( 'ICL_LANGUAGE_CODE' ) ) {
			return ICL_LANGUAGE_CODE;
		}
		if ( function_exists( 'pll_current_language' ) ) {
			return pll_current_language( 'slug' ) ?: 'default';
		}
		return 'default';
	}

	// -- Purge ----------------------------------------------------------

	public function purge_urls( array $urls ): int {
		$config     = get_option( 'silo_config', array() );
		$currencies = $this->get_purge_currencies( $config );
		$languages  = $config['variants']['language'] ?? array( 'default' );
		$count      = 0;

		foreach ( $urls as $url ) {
			foreach ( array( 'desktop', 'mobile' ) as $device ) {
				foreach ( $currencies as $currency ) {
					foreach ( $languages as $language ) {
						$key    = md5( $url . '|' . $device . '|' . $currency . '|' . $language );
						$subdir = $this->cache_dir . substr( $key, 0, 2 ) . '/';
						$html   = $subdir . $key . '.html';
						$meta   = $subdir . $key . '.json';

						if ( file_exists( $html ) ) {
							unlink( $html ); // phpcs:ignore
							$count++;
						}
						if ( file_exists( $meta ) ) {
							unlink( $meta ); // phpcs:ignore
						}
					}
				}
			}
		}
		return $count;
	}

	private function get_purge_currencies( array $config ): array {
		if ( empty( $config['variants']['currency'] ) ) {
			return array( 'default' );
		}
		if ( function_exists( 'get_woocommerce_currency' ) ) {
			$base = get_woocommerce_currency();
			if ( class_exists( 'WCML_Multi_Currency' ) ) {
				$currencies = apply_filters( 'wcml_currencies', array( $base ) );
				return is_array( $currencies ) ? array_values( $currencies ) : array( $base );
			}
			return array( $base );
		}
		return array( 'default' );
	}

	public function purge_all(): int {
		$count = 0;
		if ( ! is_dir( $this->cache_dir ) ) {
			return 0;
		}

		$iter = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $this->cache_dir, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::CHILD_FIRST
		);

		foreach ( $iter as $file ) {
			if ( $file->isFile() && ! str_starts_with( $file->getFilename(), '.stats' ) ) {
				unlink( $file->getPathname() ); // phpcs:ignore
				$count++;
			}
		}

		$this->reset_stats();
		return $count;
	}

	public function purge_store_api(): void {
		$api_dir = $this->cache_dir . 'store-api/';
		if ( ! is_dir( $api_dir ) ) {
			return;
		}

		$iter = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $api_dir, \FilesystemIterator::SKIP_DOTS ),
			\RecursiveIteratorIterator::CHILD_FIRST
		);

		foreach ( $iter as $file ) {
			if ( $file->isFile() ) {
				unlink( $file->getPathname() ); // phpcs:ignore
			}
		}
	}

	// -- Stats ----------------------------------------------------------

	public function reset_stats(): void {
		$stats = array(
			'total_hits'   => 0,
			'total_misses' => 0,
			'delta_hits'   => 0,
			'delta_misses' => 0,
			'last_reset'   => gmdate( 'Y-m-d H:i:s' ),
		);
		file_put_contents( $this->cache_dir . '.stats.json', wp_json_encode( $stats ), LOCK_EX ); // phpcs:ignore
	}

	public function get_stats(): array {
		$stats_file = $this->cache_dir . '.stats.json';
		$stats      = array();

		if ( file_exists( $stats_file ) ) {
			$stats = json_decode( file_get_contents( $stats_file ), true ) ?: array(); // phpcs:ignore
		}

		$hits   = $stats['total_hits'] ?? ( $stats['hits'] ?? 0 );
		$misses = $stats['total_misses'] ?? ( $stats['misses'] ?? 0 );
		$total  = $hits + $misses;

		$cached_pages = 0;
		if ( is_dir( $this->cache_dir ) ) {
			$iter = new \RecursiveIteratorIterator(
				new \RecursiveDirectoryIterator( $this->cache_dir, \FilesystemIterator::SKIP_DOTS )
			);
			foreach ( $iter as $file ) {
				if ( $file->isFile() && 'html' === $file->getExtension() ) {
					$cached_pages++;
				}
			}
		}

		return array(
			'hits'         => $hits,
			'misses'       => $misses,
			'hit_rate'     => $total > 0 ? round( ( $hits / $total ) * 100, 1 ) : 0,
			'cached_pages' => $cached_pages,
			'last_reset'   => $stats['last_reset'] ?? '',
		);
	}

	public function get_and_reset_delta(): array {
		$stats_file = $this->cache_dir . '.stats.json';
		if ( ! file_exists( $stats_file ) ) {
			return array( 'hits' => 0, 'misses' => 0 );
		}

		$stats = json_decode( file_get_contents( $stats_file ), true ) ?: array(); // phpcs:ignore
		$delta = array(
			'hits'   => $stats['delta_hits'] ?? 0,
			'misses' => $stats['delta_misses'] ?? 0,
		);

		$stats['delta_hits']   = 0;
		$stats['delta_misses'] = 0;
		file_put_contents( $stats_file, wp_json_encode( $stats ), LOCK_EX ); // phpcs:ignore

		return $delta;
	}

	public function get_cached_urls( int $limit = 100 ): array {
		$urls = array();
		if ( ! is_dir( $this->cache_dir ) ) {
			return $urls;
		}

		$iter = new \RecursiveIteratorIterator(
			new \RecursiveDirectoryIterator( $this->cache_dir, \FilesystemIterator::SKIP_DOTS )
		);

		foreach ( $iter as $file ) {
			if ( $file->isFile() && 'json' === $file->getExtension() && ! str_starts_with( $file->getFilename(), '.' ) ) {
				$meta = json_decode( file_get_contents( $file->getPathname() ), true ); // phpcs:ignore
				if ( $meta && isset( $meta['url'] ) ) {
					$age    = time() - ( $meta['created'] ?? 0 );
					$ttl    = $meta['ttl'] ?? 3600;
					$urls[] = array(
						'url'      => $meta['url'],
						'device'   => $meta['device'] ?? 'desktop',
						'currency' => $meta['currency'] ?? 'default',
						'language' => $meta['language'] ?? 'default',
						'age'      => $age,
						'ttl'      => $ttl,
						'fresh'    => $age <= $ttl,
						'size'     => $this->get_html_size( $file->getPathname() ),
					);
				}
				if ( count( $urls ) >= $limit ) {
					break;
				}
			}
		}

		usort( $urls, fn( $a, $b ) => $a['age'] - $b['age'] );
		return $urls;
	}

	private function get_html_size( string $meta_path ): int {
		$html_path = str_replace( '.json', '.html', $meta_path );
		return file_exists( $html_path ) ? (int) filesize( $html_path ) : 0;
	}
}
