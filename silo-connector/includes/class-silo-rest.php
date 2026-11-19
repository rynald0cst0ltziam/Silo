<?php
/**
 * Inbound endpoints for the Silo service (/wp-json/silo/v1/*). Every route requires a
 * request signed with this store's key.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * REST routes.
 */
class Silo_Rest {

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/**
	 * Routes.
	 */
	public static function routes(): void {
		$routes = array(
			'/status'      => array( 'GET', 'status' ),
			'/stats'       => array( 'GET', 'status' ),
			'/purge'       => array( 'POST', 'purge' ),
			'/reset-stats' => array( 'POST', 'reset_stats' ),
			'/scan'        => array( 'POST', 'scan' ),
			'/cached-urls' => array( 'GET', 'cached_urls' ),
			'/apply'       => array( 'POST', 'apply' ),
			'/warm'        => array( 'POST', 'warm' ),
		);
		foreach ( $routes as $path => $route ) {
			register_rest_route(
				'silo/v1',
				$path,
				array(
					'methods'             => $route[0],
					'callback'            => array( __CLASS__, $route[1] ),
					'permission_callback' => array( 'Silo_Api', 'verify' ),
				)
			);
		}
	}

	/**
	 * Status.
	 */
	public static function status(): WP_REST_Response {
		update_option( 'silo_hb_ok', time(), false );
		return new WP_REST_Response( Silo_Heartbeat::payload(), 200 );
	}

	/**
	 * Purge.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function purge( WP_REST_Request $request ): WP_REST_Response {
		if ( $request->get_param( 'all' ) ) {
			$reset = false !== $request->get_param( 'reset_stats' );
			$count = Silo_Page_Cache::purge_everything( $reset );
			Silo_Events::log_purge_all( 'silo', $count, false );
			return new WP_REST_Response(
				array(
					'purged' => $count,
					'type'   => 'all',
					'stats'  => Silo_Stats::summary(),
				),
				200
			);
		}

		$urls = array_filter( (array) $request->get_param( 'urls' ), 'is_string' );
		if ( ! $urls ) {
			return new WP_REST_Response( array( 'error' => 'Provide urls or all=true' ), 400 );
		}
		$result = Silo_Page_Cache::purge_urls( $urls );
		$ids    = array_map( 'intval', (array) $request->get_param( 'product_ids' ) );
		if ( $ids ) {
			Silo_Store_API_Cache::purge( 'collections', $ids );
		}
		return new WP_REST_Response(
			array(
				'purged' => $result['pages'],
				'urls'   => $result['urls'],
				'type'   => 'selective',
			),
			200
		);
	}

	/**
	 * Reset stats.
	 */
	public static function reset_stats(): WP_REST_Response {
		$stats = Silo_Stats::reset();
		return new WP_REST_Response(
			array(
				'ok'    => true,
				'epoch' => $stats['epoch'],
			),
			200
		);
	}

	/**
	 * Scan.
	 */
	public static function scan(): WP_REST_Response {
		if ( Silo_Scanner::is_running() ) {
			return new WP_REST_Response(
				array(
					'started' => false,
					'running' => true,
					'state'   => Silo_Scanner::public_state(),
				),
				200
			);
		}
		$state = Silo_Scanner::start_background( 'silo' );
		return new WP_REST_Response(
			array(
				'started' => true,
				'state'   => Silo_Scanner::public_state( $state ),
			),
			202
		);
	}

	/**
	 * Cached URLs.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function cached_urls( WP_REST_Request $request ): WP_REST_Response {
		$limit = max( 1, min( 500, (int) ( $request->get_param( 'limit' ) ? $request->get_param( 'limit' ) : 100 ) ) );
		return new WP_REST_Response(
			array(
				'cached_urls' => Silo_Page_Cache::entries( $limit ),
				'inventory'   => Silo_Page_Cache::inventory( true ),
				'stats'       => Silo_Stats::summary(),
			),
			200
		);
	}

	/**
	 * Apply.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function apply( WP_REST_Request $request ): WP_REST_Response {
		$config  = $request->get_param( 'config' );
		$applied = is_array( $config ) && Silo_Settings::apply_remote_config( $config );
		$purged  = 0;
		$warmed  = 0;

		$purge = array_filter( (array) $request->get_param( 'purge' ), 'is_string' );
		if ( $purge ) {
			$purged = Silo_Page_Cache::purge_urls( $purge )['pages'];
		}
		$warm = array_filter( (array) $request->get_param( 'warm' ), 'is_string' );
		if ( $warm ) {
			$warmed = Silo_Warmup::enqueue( $warm, (string) ( $request->get_param( 'job_id' ) ? $request->get_param( 'job_id' ) : 'apply' ), 'apply' );
		}

		return new WP_REST_Response(
			array(
				'config_applied' => $applied,
				'config_version' => (int) ( Silo_Settings::remote_config()['version'] ?? 0 ),
				'purged'         => $purged,
				'warm_queued'    => $warmed,
			),
			200
		);
	}

	/**
	 * Warm.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function warm( WP_REST_Request $request ): WP_REST_Response {
		$urls = array_filter( (array) $request->get_param( 'urls' ), 'is_string' );
		if ( ! $urls ) {
			return new WP_REST_Response( array( 'error' => 'No URLs provided' ), 400 );
		}
		$queued = Silo_Warmup::enqueue( $urls, (string) $request->get_param( 'job_id' ), (string) ( $request->get_param( 'source' ) ? $request->get_param( 'source' ) : 'silo' ) );
		return new WP_REST_Response( array( 'queued' => $queued ), 202 );
	}
}
