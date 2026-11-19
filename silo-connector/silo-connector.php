<?php
/**
 * Plugin Name: Silo — WooCommerce Cache Connector
 * Plugin URI:  https://getsilo.io
 * Description: Connects your WooCommerce store to Silo for inventory-aware surgical cache invalidation and intelligent warmup.
 * Version:     2.0.0
 * Author:      Silo
 * Author URI:  https://getsilo.io
 * Requires PHP: 8.1
 * Requires at least: 6.4
 * WC requires at least: 8.2
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: silo-connector
 */

defined( 'ABSPATH' ) || exit;

define( 'SILO_VERSION', '2.0.0' );
define( 'SILO_PLUGIN_FILE', __FILE__ );
define( 'SILO_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'SILO_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'SILO_CACHE_DIR', WP_CONTENT_DIR . '/cache/silo/' );

final class Silo_Connector {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->load_includes();
		$this->register_hooks();
	}

	private function load_includes(): void {
		$dir = SILO_PLUGIN_DIR . 'includes/';
		require_once $dir . 'class-page-cache.php';
		require_once $dir . 'class-event-reporter.php';
		require_once $dir . 'class-config-applier.php';
		require_once $dir . 'class-warmup.php';
		require_once $dir . 'class-store-api-cache.php';
		require_once $dir . 'class-scanner.php';
		require_once $dir . 'class-rest-api.php';

		if ( is_admin() ) {
			require_once $dir . 'class-admin.php';
		}
	}

	private function register_hooks(): void {
		add_action( 'init', array( $this, 'init' ) );
		add_action( 'rest_api_init', array( $this, 'register_rest_routes' ) );
		add_filter( 'cron_schedules', array( $this, 'add_cron_schedules' ) );
		add_action( 'silo_heartbeat_cron', array( $this, 'send_heartbeat' ) );
		add_action( 'silo_initial_warmup', array( $this, 'run_initial_warmup' ) );

		register_activation_hook( SILO_PLUGIN_FILE, array( $this, 'activate' ) );
		register_deactivation_hook( SILO_PLUGIN_FILE, array( $this, 'deactivate' ) );
	}

	public function init(): void {
		if ( ! $this->is_configured() ) {
			return;
		}

		Silo_Event_Reporter::instance()->register_hooks();
		Silo_Store_API_Cache::instance()->register_hooks();
	}

	public function register_rest_routes(): void {
		Silo_REST_API::instance()->register_routes();
	}

	public function is_configured(): bool {
		return ! empty( get_option( 'silo_api_key', '' ) );
	}

	public function get_api_key(): string {
		return get_option( 'silo_api_key', '' );
	}

	public function get_saas_url(): string {
		return rtrim( get_option( 'silo_saas_url', 'https://app.getsilo.io' ), '/' );
	}

	public function page_cache(): Silo_Page_Cache {
		return Silo_Page_Cache::instance();
	}

	public function warmup(): Silo_Warmup {
		return Silo_Warmup::instance();
	}

	public function scanner(): Silo_Scanner {
		return Silo_Scanner::instance();
	}

	public function sign_request( string $body ): array {
		$api_key   = $this->get_api_key();
		$timestamp = (string) time();
		$signature = hash_hmac( 'sha256', $timestamp . '.' . $body, $api_key );

		return array(
			'Content-Type'     => 'application/json',
			'X-Silo-Signature' => $signature,
			'X-Silo-Timestamp' => $timestamp,
			'X-Silo-Store-Key' => $api_key,
		);
	}

	public function verify_hmac( \WP_REST_Request $request ): bool {
		$api_key = $this->get_api_key();
		if ( empty( $api_key ) ) {
			return false;
		}

		$signature = $request->get_header( 'X-Silo-Signature' );
		$timestamp = $request->get_header( 'X-Silo-Timestamp' );

		if ( ! $signature || ! $timestamp ) {
			return false;
		}

		if ( abs( time() - (int) $timestamp ) > 300 ) {
			return false;
		}

		$body     = $request->get_body();
		$expected = hash_hmac( 'sha256', $timestamp . '.' . $body, $api_key );

		return hash_equals( $expected, $signature );
	}

	public function add_cron_schedules( array $schedules ): array {
		$schedules['silo_five_minutes'] = array(
			'interval' => 300,
			'display'  => esc_html__( 'Every 5 minutes (Silo)', 'silo-connector' ),
		);
		return $schedules;
	}

	public function send_heartbeat(): void {
		if ( ! $this->is_configured() ) {
			return;
		}

		$stats = $this->page_cache()->get_stats();
		$delta = $this->page_cache()->get_and_reset_delta();

		$body = wp_json_encode( array(
			'stats' => $stats,
			'delta' => $delta,
		) );

		wp_remote_post( $this->get_saas_url() . '/api/stores/heartbeat', array(
			'timeout' => 10,
			'headers' => $this->sign_request( $body ),
			'body'    => $body,
		) );
	}

	public function run_initial_warmup(): void {
		if ( ! $this->is_configured() || get_option( 'silo_warmup_enabled', '1' ) !== '1' ) {
			return;
		}

		$urls   = array();
		$urls[] = home_url( '/' );

		if ( function_exists( 'wc_get_page_id' ) ) {
			$shop_id = wc_get_page_id( 'shop' );
			if ( $shop_id > 0 ) {
				$shop_url = get_permalink( $shop_id );
				if ( $shop_url ) {
					$urls[] = $shop_url;
				}
			}
		}

		$categories = get_terms( array(
			'taxonomy'   => 'product_cat',
			'orderby'    => 'count',
			'order'      => 'DESC',
			'number'     => 10,
			'hide_empty' => true,
		) );
		if ( ! is_wp_error( $categories ) ) {
			foreach ( $categories as $cat ) {
				$url = get_term_link( $cat );
				if ( ! is_wp_error( $url ) ) {
					$urls[] = $url;
				}
			}
		}

		$bestsellers = $this->scanner()->get_bestseller_ids( 20 );
		foreach ( $bestsellers as $pid ) {
			$url = get_permalink( $pid );
			if ( $url ) {
				$urls[] = $url;
			}
		}

		$urls = array_unique( array_filter( $urls ) );
		if ( ! empty( $urls ) ) {
			$this->warmup()->warm_urls( $urls );
		}
	}

	public function activate(): void {
		if ( ! is_dir( SILO_CACHE_DIR ) ) {
			wp_mkdir_p( SILO_CACHE_DIR );
		}

		$this->install_dropin();

		if ( ! defined( 'WP_CACHE' ) || ! WP_CACHE ) {
			self::set_wp_cache_constant( true );
		}

		if ( ! wp_next_scheduled( 'silo_heartbeat_cron' ) ) {
			wp_schedule_event( time(), 'silo_five_minutes', 'silo_heartbeat_cron' );
		}

		update_option( 'silo_version', SILO_VERSION );
	}

	public function deactivate(): void {
		$dropin = WP_CONTENT_DIR . '/advanced-cache.php';
		if ( file_exists( $dropin ) ) {
			$content = file_get_contents( $dropin ); // phpcs:ignore
			if ( str_contains( $content, 'silo-connector' ) ) {
				unlink( $dropin ); // phpcs:ignore
			}
		}

		self::set_wp_cache_constant( false );

		foreach ( array( 'silo_heartbeat_cron', 'silo_initial_warmup' ) as $hook ) {
			wp_unschedule_hook( $hook );
		}
	}

	private function install_dropin(): void {
		$source = SILO_PLUGIN_DIR . 'advanced-cache.php';
		$dest   = WP_CONTENT_DIR . '/advanced-cache.php';

		if ( file_exists( $source ) && ( ! file_exists( $dest ) || ! str_contains( file_get_contents( $dest ), 'silo-connector' ) ) ) { // phpcs:ignore
			copy( $source, $dest ); // phpcs:ignore
		}
	}

	public static function set_wp_cache_constant( bool $enable ): void {
		$config_file = ABSPATH . 'wp-config.php';
		if ( ! is_writable( $config_file ) ) {
			return;
		}

		$content = file_get_contents( $config_file ); // phpcs:ignore
		$content = preg_replace(
			"/define\s*\(\s*['\"]WP_CACHE['\"]\s*,\s*(true|false)\s*\)\s*;\s*\n?/",
			'',
			$content
		);

		if ( $enable ) {
			$content = preg_replace(
				"/(\/\*\*.*?That's all.*?\*\/|<\?php)/s",
				"$1\ndefine('WP_CACHE', true);",
				$content,
				1
			);
		}

		file_put_contents( $config_file, $content ); // phpcs:ignore
	}
}

function silo(): Silo_Connector {
	return Silo_Connector::instance();
}

silo();
