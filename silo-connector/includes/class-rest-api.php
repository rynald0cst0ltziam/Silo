<?php
/**
 * REST API: all /silo/v1/* route registration.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_REST_API {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_routes(): void {
		$namespace = 'silo/v1';

		register_rest_route( $namespace, '/apply', array(
			'methods'             => 'POST',
			'callback'            => array( Silo_Config_Applier::instance(), 'handle_apply' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/status', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_status' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/stats', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_stats' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/purge', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_purge' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/warm', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_warm' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/cached-urls', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_cached_urls' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/scan', array(
			'methods'             => 'POST',
			'callback'            => array( $this, 'handle_scan' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );

		register_rest_route( $namespace, '/scan/progress', array(
			'methods'             => 'GET',
			'callback'            => array( $this, 'handle_scan_progress' ),
			'permission_callback' => array( $this, 'verify_hmac' ),
		) );
	}

	public function verify_hmac( \WP_REST_Request $request ): bool {
		return silo()->verify_hmac( $request );
	}

	public function handle_status( \WP_REST_Request $request ): \WP_REST_Response {
		$dropin = WP_CONTENT_DIR . '/advanced-cache.php';
		$dropin_installed = file_exists( $dropin ) && str_contains( file_get_contents( $dropin ), 'silo-connector' ); // phpcs:ignore

		return new \WP_REST_Response( array(
			'version'           => SILO_VERSION,
			'wp_version'        => get_bloginfo( 'version' ),
			'wc_version'        => defined( 'WC_VERSION' ) ? WC_VERSION : 'unknown',
			'php_version'       => PHP_VERSION,
			'wp_cache'          => defined( 'WP_CACHE' ) && WP_CACHE,
			'dropin_installed'  => $dropin_installed,
			'cache_dir_writable' => is_writable( SILO_CACHE_DIR ),
			'cache_enabled'     => get_option( 'silo_cache_enabled', '1' ) === '1',
			'events_enabled'    => get_option( 'silo_events_enabled', '1' ) === '1',
			'warmup_enabled'    => get_option( 'silo_warmup_enabled', '1' ) === '1',
			'store_api_enabled' => ( get_option( 'silo_config', array() )['store_api']['enabled'] ?? true ),
			'last_scan'         => get_option( 'silo_last_scan', null ),
		), 200 );
	}

	public function handle_stats( \WP_REST_Request $request ): \WP_REST_Response {
		$stats = silo()->page_cache()->get_stats();
		$delta = silo()->page_cache()->get_and_reset_delta();

		return new \WP_REST_Response( array(
			'stats' => $stats,
			'delta' => $delta,
		), 200 );
	}

	public function handle_purge( \WP_REST_Request $request ): \WP_REST_Response {
		$urls = $request->get_param( 'urls' );
		$all  = $request->get_param( 'all' );

		if ( $all ) {
			$count = silo()->page_cache()->purge_all();
			Silo_Store_API_Cache::instance()->purge_all();
			return new \WP_REST_Response( array( 'purged' => $count, 'type' => 'all' ), 200 );
		}

		if ( ! empty( $urls ) && is_array( $urls ) ) {
			$count = silo()->page_cache()->purge_urls( $urls );
			return new \WP_REST_Response( array( 'purged' => $count, 'type' => 'selective' ), 200 );
		}

		return new \WP_REST_Response( array( 'error' => 'No URLs or all flag provided' ), 400 );
	}

	public function handle_warm( \WP_REST_Request $request ): \WP_REST_Response {
		$urls = $request->get_param( 'urls' );

		if ( empty( $urls ) || ! is_array( $urls ) ) {
			return new \WP_REST_Response( array( 'error' => 'No URLs provided' ), 400 );
		}

		$warmed = silo()->warmup()->warm_urls( $urls );
		return new \WP_REST_Response( array( 'warmed' => $warmed ), 200 );
	}

	public function handle_cached_urls( \WP_REST_Request $request ): \WP_REST_Response {
		$limit = (int) ( $request->get_param( 'limit' ) ?: 100 );
		$urls  = silo()->page_cache()->get_cached_urls( $limit );
		return new \WP_REST_Response( array( 'urls' => $urls, 'count' => count( $urls ) ), 200 );
	}

	public function handle_scan( \WP_REST_Request $request ): \WP_REST_Response {
		$snapshot = silo()->scanner()->run_scan();
		return new \WP_REST_Response( array( 'snapshot' => $snapshot ), 200 );
	}

	public function handle_scan_progress( \WP_REST_Request $request ): \WP_REST_Response {
		$progress = silo()->scanner()->get_scan_progress();
		return new \WP_REST_Response( $progress, 200 );
	}
}
