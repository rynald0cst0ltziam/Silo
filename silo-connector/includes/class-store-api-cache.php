<?php
/**
 * Store API cache: caches WooCommerce Store API (Block-based) responses.
 * Endpoints: /wc/store/v1/products, /wc/store/v1/products/collection-data, etc.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Store_API_Cache {

	private static ?self $instance = null;
	private string $cache_dir;

	private const CACHEABLE_ENDPOINTS = array(
		'/wc/store/v1/products',
		'/wc/store/v1/products/collection-data',
		'/wc/store/v1/products/categories',
		'/wc/store/v1/products/tags',
		'/wc/store/v1/products/attributes',
	);

	private const NEVER_CACHE = array(
		'/wc/store/v1/cart',
		'/wc/store/v1/checkout',
		'/wc/store/v1/batch',
		'/wc/store/v1/order',
	);

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		$this->cache_dir = SILO_CACHE_DIR . 'store-api/';
	}

	public function register_hooks(): void {
		$config  = get_option( 'silo_config', array() );
		$enabled = $config['store_api']['enabled'] ?? true;

		if ( ! $enabled ) {
			return;
		}

		add_filter( 'rest_pre_dispatch', array( $this, 'maybe_serve_cached' ), 10, 3 );
		add_filter( 'rest_post_dispatch', array( $this, 'maybe_cache_response' ), 10, 3 );
	}

	public function maybe_serve_cached( $result, \WP_REST_Server $server, \WP_REST_Request $request ) {
		if ( null !== $result ) {
			return $result;
		}

		if ( 'GET' !== $request->get_method() ) {
			return $result;
		}

		$route = $request->get_route();
		if ( ! $this->is_cacheable_route( $route ) ) {
			return $result;
		}

		if ( is_user_logged_in() ) {
			return $result;
		}

		$cache_key = $this->build_cache_key( $request );
		$cached    = $this->read_cache( $cache_key );

		if ( false === $cached ) {
			return $result;
		}

		$response = new \WP_REST_Response( $cached['data'], $cached['status'] );
		foreach ( $cached['headers'] as $key => $value ) {
			$response->header( $key, $value );
		}
		$response->header( 'X-Silo-StoreAPI', 'HIT' );
		$response->header( 'X-Silo-Key', $cache_key );

		return $response;
	}

	public function maybe_cache_response( \WP_REST_Response $response, \WP_REST_Server $server, \WP_REST_Request $request ): \WP_REST_Response {
		if ( 'GET' !== $request->get_method() ) {
			return $response;
		}

		$route = $request->get_route();
		if ( ! $this->is_cacheable_route( $route ) ) {
			return $response;
		}

		if ( is_user_logged_in() ) {
			return $response;
		}

		$status = $response->get_status();
		if ( $status < 200 || $status >= 300 ) {
			return $response;
		}

		if ( $response->get_matched_handler() && isset( $response->get_matched_handler()['allow_batch'] ) ) {
			return $response;
		}

		$cache_key = $this->build_cache_key( $request );
		$config    = get_option( 'silo_config', array() );
		$ttl       = $config['store_api']['ttl'] ?? 300;

		$entry = array(
			'data'    => $response->get_data(),
			'status'  => $status,
			'headers' => $response->get_headers(),
			'created' => time(),
			'ttl'     => $ttl,
		);

		$this->write_cache( $cache_key, $entry );
		$response->header( 'X-Silo-StoreAPI', 'MISS' );
		$response->header( 'X-Silo-Key', $cache_key );

		return $response;
	}

	private function is_cacheable_route( string $route ): bool {
		foreach ( self::NEVER_CACHE as $pattern ) {
			if ( str_starts_with( $route, $pattern ) ) {
				return false;
			}
		}

		foreach ( self::CACHEABLE_ENDPOINTS as $pattern ) {
			if ( str_starts_with( $route, $pattern ) ) {
				return true;
			}
		}

		return false;
	}

	private function build_cache_key( \WP_REST_Request $request ): string {
		$route    = $request->get_route();
		$params   = $request->get_query_params();
		ksort( $params );

		$currency = $this->detect_currency();
		$language = $this->detect_language();

		$raw = $route . '|' . wp_json_encode( $params ) . '|' . $currency . '|' . $language;
		return md5( $raw );
	}

	private function detect_currency(): string {
		if ( isset( $_GET['currency'] ) ) { // phpcs:ignore
			return sanitize_text_field( wp_unslash( $_GET['currency'] ) ); // phpcs:ignore
		}
		if ( isset( $_COOKIE['wcml_client_currency'] ) ) {
			return sanitize_text_field( wp_unslash( $_COOKIE['wcml_client_currency'] ) );
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

	private function read_cache( string $key ) {
		$file = $this->cache_dir . $key . '.json';
		if ( ! file_exists( $file ) ) {
			return false;
		}

		$data = json_decode( file_get_contents( $file ), true ); // phpcs:ignore
		if ( ! $data || ! isset( $data['created'], $data['ttl'] ) ) {
			return false;
		}

		if ( ( time() - $data['created'] ) > $data['ttl'] ) {
			unlink( $file ); // phpcs:ignore
			return false;
		}

		return $data;
	}

	private function write_cache( string $key, array $entry ): void {
		if ( ! is_dir( $this->cache_dir ) ) {
			wp_mkdir_p( $this->cache_dir );
		}

		file_put_contents( $this->cache_dir . $key . '.json', wp_json_encode( $entry ), LOCK_EX ); // phpcs:ignore
	}

	public function purge_all(): void {
		silo()->page_cache()->purge_store_api();
	}
}
