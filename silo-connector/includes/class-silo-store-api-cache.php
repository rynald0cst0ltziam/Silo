<?php
/**
 * Store API cache: anonymous GET responses from catalog routes (/wc/store/v1/products,
 * collection data, categories, tags, attributes, brands, reviews) cached per filter set.
 *
 * Cart, checkout, batch and order routes never enter the cache. Responses are replayed
 * with a strict header whitelist so nonces and cart tokens can never leak between shoppers.
 * Each entry records the product IDs it contains, so a change invalidates only the
 * filter sets that can include that product.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.ValidatedSanitizedInput

/**
 * Store API response cache.
 */
class Silo_Store_API_Cache {

	const CACHEABLE = '#^/wc/store(/v1)?/products(/(collection-data|attributes|categories|tags|brands|reviews)(/.*)?|/\d+)?$#';
	const HEADERS   = array( 'X-WP-Total', 'X-WP-TotalPages', 'Link' );

	/**
	 * Key of the response being served from cache in this request.
	 *
	 * @var string
	 */
	private static $served = '';

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_filter( 'rest_pre_dispatch', array( __CLASS__, 'serve' ), 10, 3 );
		add_filter( 'rest_post_dispatch', array( __CLASS__, 'store' ), 99, 3 );
	}

	/**
	 * Config.
	 */
	private static function config(): ?array {
		$config = silo_load_site_config( Silo_Settings::site_dir() );
		return ( $config && ! empty( $config['store_api'] ) ) ? $config : null;
	}

	/**
	 * Dir.
	 */
	private static function dir(): string {
		return Silo_Settings::site_dir() . 'api/';
	}

	/**
	 * Only anonymous, nonce-free GETs on catalog routes qualify.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private static function eligible( WP_REST_Request $request ): bool {
		if ( 'GET' !== $request->get_method() || ! preg_match( self::CACHEABLE, $request->get_route() ) ) {
			return false;
		}
		if ( $request->get_header( 'nonce' ) || $request->get_header( 'x_wc_store_api_nonce' ) || $request->get_header( 'cart_token' ) || $request->get_param( '_wpnonce' ) ) {
			return false;
		}
		if ( is_user_logged_in() || '' !== silo_session_bypass_reason( $_COOKIE, $_SERVER ) ) {
			return false;
		}
		$config = self::config();
		if ( null === $config ) {
			return false;
		}
		return empty( $config['variants']['country'] ) || null !== silo_request_country( $_SERVER );
	}

	/**
	 * Key.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private static function key( WP_REST_Request $request ): string {
		$params = $request->get_query_params();
		unset( $params['_locale'] );
		ksort( $params );
		$config   = (array) self::config();
		$variants = (array) ( $config['variants'] ?? array() );
		$currency = ! empty( $variants['currency'] ) ? silo_request_currency( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only storefront variant (currency), sanitised by silo_token().
		$language = ! empty( $variants['language_cookie'] ) ? silo_request_language( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Read-only storefront variant (language), sanitised by silo_token().
		$country  = ! empty( $variants['country'] ) ? (string) silo_request_country( $_SERVER ) : '';

		return md5( $request->get_route() . '|' . wp_json_encode( $params ) . '|' . $currency . '|' . $language . '|' . $country );
	}

	/**
	 * Short-circuit dispatch with a cached response.
	 *
	 * @param mixed           $result  Response so far (null if not handled).
	 * @param WP_REST_Server  $server  Server.
	 * @param WP_REST_Request $request Request.
	 * @return mixed
	 */
	public static function serve( $result, $server, $request ) {
		self::$served = '';
		if ( null !== $result || ! $request instanceof WP_REST_Request || ! self::eligible( $request ) ) {
			return $result;
		}

		$key  = self::key( $request );
		$file = self::dir() . $key . '.json';
		if ( ! is_file( $file ) ) {
			return $result;
		}

		$entry = json_decode( (string) file_get_contents( $file ), true );
		if ( ! is_array( $entry ) || ( time() - (int) ( $entry['created'] ?? 0 ) ) > (int) ( $entry['ttl'] ?? 300 ) ) {
			wp_delete_file( $file );
			return $result;
		}

		Silo_Stats::bump( array( 'api_hits' => 1 ) );
		self::$served = $key;

		$response = new WP_REST_Response( $entry['data'], (int) ( $entry['status'] ?? 200 ) );
		foreach ( (array) ( $entry['headers'] ?? array() ) as $name => $value ) {
			$response->header( (string) $name, (string) $value );
		}
		$response->header( 'X-Silo-Cache', 'HIT' );
		$response->header( 'X-Silo-Age', (string) ( time() - (int) $entry['created'] ) );
		return $response;
	}

	/**
	 * Store a freshly generated response.
	 *
	 * @param WP_HTTP_Response $response Response.
	 * @param WP_REST_Server   $server   Server.
	 * @param WP_REST_Request  $request  Request.
	 * @return WP_HTTP_Response
	 */
	public static function store( $response, $server, $request ) {
		if ( ! $response instanceof WP_REST_Response || ! $request instanceof WP_REST_Request ) {
			return $response;
		}
		if ( '' !== self::$served ) {
			self::$served = '';
			return $response; // Already a cache hit.
		}
		if ( 200 !== $response->get_status() || ! self::eligible( $request ) ) {
			return $response;
		}

		$config  = (array) self::config();
		$headers = array();
		foreach ( $response->get_headers() as $name => $value ) {
			foreach ( self::HEADERS as $allowed ) {
				if ( 0 === strcasecmp( (string) $name, $allowed ) ) {
					$headers[ $allowed ] = is_array( $value ) ? implode( ', ', $value ) : (string) $value;
				}
			}
		}

		$data  = $response->get_data();
		$entry = array(
			'route'    => $request->get_route(),
			'data'     => $data,
			'status'   => 200,
			'headers'  => $headers,
			'created'  => time(),
			'ttl'      => (int) ( $config['ttl']['store_api'] ?? 300 ),
			'products' => self::product_ids( $data ),
			'list'     => ! preg_match( '#/products/\d+$#', $request->get_route() ),
		);

		$dir = self::dir();
		if ( wp_mkdir_p( $dir ) ) {
			$key = self::key( $request );
			$tmp = $dir . $key . '.' . wp_generate_password( 6, false, false );
			if ( false !== file_put_contents( $tmp, (string) wp_json_encode( $entry ) ) ) {
				rename( $tmp, $dir . $key . '.json' );
				// Product index alongside, so purges never have to decode full responses.
				file_put_contents( $dir . $key . '.ids', ',' . implode( ',', $entry['products'] ) . ',' . ( $entry['list'] ? 'L' : '' ) );
			}
			Silo_Stats::bump( array( 'api_misses' => 1 ) );
			$response->header( 'X-Silo-Cache', 'MISS' );
		}

		return $response;
	}

	/**
	 * Product IDs present in a response body.
	 *
	 * @param mixed $data Response data.
	 */
	private static function product_ids( $data ): array {
		$ids = array();
		if ( is_array( $data ) && isset( $data['id'] ) && is_numeric( $data['id'] ) ) {
			$ids[] = (int) $data['id'];
			if ( isset( $data['parent'] ) && (int) $data['parent'] > 0 ) {
				$ids[] = (int) $data['parent'];
			}
		} elseif ( is_array( $data ) ) {
			foreach ( $data as $item ) {
				if ( is_array( $item ) && isset( $item['id'] ) && is_numeric( $item['id'] ) ) {
					$ids[] = (int) $item['id'];
				}
				if ( is_array( $item ) && isset( $item['product_id'] ) ) {
					$ids[] = (int) $item['product_id'];
				}
			}
		}
		return array_values( array_unique( $ids ) );
	}

	/**
	 * Invalidate entries.
	 *
	 * @param string $mode        'products' (entries containing the IDs), 'collections'
	 *                            (also every list/filter response) or 'all'.
	 * @param int[]  $product_ids Affected product and variation IDs.
	 */
	public static function purge( string $mode, array $product_ids = array() ): int {
		$dir = self::dir();
		if ( ! is_dir( $dir ) ) {
			return 0;
		}
		if ( 'all' === $mode ) {
			return Silo_Page_Cache::delete_tree( $dir );
		}

		$needles = array();
		foreach ( array_unique( array_map( 'intval', $product_ids ) ) as $id ) {
			if ( $id > 0 ) {
				$needles[] = ',' . $id . ',';
			}
		}

		$removed = 0;
		foreach ( (array) glob( $dir . '*.ids' ) as $index ) {
			if ( ! is_string( $index ) ) {
				continue;
			}
			$ids   = (string) file_get_contents( $index );
			$match = 'collections' === $mode && str_ends_with( $ids, 'L' );
			foreach ( $needles as $needle ) {
				if ( $match ) {
					break;
				}
				$match = str_contains( $ids, $needle );
			}
			if ( $match ) {
				wp_delete_file( substr( $index, 0, -4 ) . '.json' );
				wp_delete_file( $index );
				++$removed;
			}
		}
		if ( $removed ) {
			delete_transient( 'silo_inventory' );
		}
		return $removed;
	}
}
