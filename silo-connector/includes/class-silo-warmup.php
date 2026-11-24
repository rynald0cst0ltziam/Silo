<?php
/**
 * Warmup engine. Silo decides what to warm (priority order, plan cap); the connector
 * fetches those URLs from the store itself, in parallel, for desktop and mobile, and
 * reports per-URL results back so both dashboards show progress live.
 *
 * Runs in the background through Action Scheduler (bundled with WooCommerce),
 * never during a shopper's request.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

/**
 * Warmup queue and runner.
 */
class Silo_Warmup {

	const HOOK       = 'silo_warmup_run';
	const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) SiloWarmup/2 (+https://heysilo.co)';
	const UA_MOBILE  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile SiloWarmup/2 (+https://heysilo.co)';

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run' ) );
	}

	/**
	 * Table.
	 */
	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'silo_warmup';
	}

	/**
	 * Queue URLs under a job. Only URLs on this store's own host are ever fetched.
	 *
	 * @param string[] $urls   URLs in priority order.
	 * @param string   $job_id Silo warmup job ID ('refresh' for local stale refreshes).
	 * @param string   $source Origin label.
	 */
	public static function enqueue( array $urls, string $job_id, string $source = 'event' ): int {
		global $wpdb;

		$home  = strtolower( Silo_Settings::site_host() );
		$table = self::table();
		$now   = current_time( 'mysql', true );
		$added = 0;

		foreach ( array_values( array_unique( array_map( 'strval', $urls ) ) ) as $position => $url ) {
			$url   = esc_url_raw( $url );
			$parts = wp_parse_url( $url );
			if ( empty( $parts['host'] ) ) {
				continue;
			}
			$host = strtolower( $parts['host'] . ( isset( $parts['port'] ) ? ':' . $parts['port'] : '' ) );
			if ( $host !== $home ) {
				continue;
			}

			$hash   = md5( $url );
			$exists = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE url_hash = %s AND status IN ('queued','warming') LIMIT 1", $hash ) );
			if ( $exists ) {
				continue;
			}

			$wpdb->insert(
				$table,
				array(
					'job_id'     => substr( $job_id, 0, 40 ),
					'url'        => $url,
					'url_hash'   => $hash,
					'priority'   => min( 65000, $position + ( 'refresh' === $source ? 1000 : 0 ) ),
					'status'     => 'queued',
					'created_at' => $now,
					'updated_at' => $now,
				)
			);
			++$added;
		}

		if ( $added > 0 ) {
			self::schedule();
		}
		return $added;
	}

	/**
	 * Schedule.
	 *
	 * @param int $delay Delay.
	 */
	public static function schedule( int $delay = 0 ): void {
		if ( ! Silo_Settings::get( 'warmup' ) ) {
			return;
		}
		if ( function_exists( 'as_enqueue_async_action' ) && 0 === $delay ) {
			if ( ! as_has_scheduled_action( self::HOOK, array(), 'silo' ) ) {
				as_enqueue_async_action( self::HOOK, array(), 'silo' );
			}
			return;
		}
		if ( function_exists( 'as_schedule_single_action' ) ) {
			if ( ! as_has_scheduled_action( self::HOOK, array(), 'silo' ) ) {
				as_schedule_single_action( time() + $delay, self::HOOK, array(), 'silo' );
			}
			return;
		}
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_single_event( time() + $delay, self::HOOK );
		}
	}

	/**
	 * Background runner: drain the queue in parallel batches for up to ~22 seconds.
	 */
	public static function run(): void {
		global $wpdb;
		if ( ! Silo_Settings::is_connected() || ! Silo_Settings::get( 'warmup' ) ) {
			return;
		}
		if ( get_transient( 'silo_warmup_lock' ) ) {
			return;
		}
		set_transient( 'silo_warmup_lock', 1, 90 );

		$table       = self::table();
		$concurrency = max( 1, min( 8, (int) Silo_Settings::get( 'warmup_concurrency' ) ) );
		$deadline    = microtime( true ) + 22;

		try {
			while ( microtime( true ) < $deadline ) {
				$rows = (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE status = 'queued' ORDER BY priority ASC, id ASC LIMIT %d", $concurrency ) );
				if ( ! $rows ) {
					break;
				}

				$ids = array_map( 'intval', wp_list_pluck( $rows, 'id' ) );
				$wpdb->query( "UPDATE {$table} SET status = 'warming', updated_at = '" . esc_sql( current_time( 'mysql', true ) ) . "' WHERE id IN (" . implode( ',', $ids ) . ')' ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

				$results = self::fetch( $rows );
				$jobs    = array();
				$now     = current_time( 'mysql', true );

				foreach ( $rows as $row ) {
					$result = $results[ (int) $row->id ] ?? array(
						'status' => 'failed',
						'error'  => 'No response',
					);
					$retry  = 'failed' === $result['status'] && (int) $row->attempts < 1;

					$wpdb->update(
						$table,
						array(
							'status'      => $retry ? 'queued' : $result['status'],
							'http_code'   => (int) ( $result['code'] ?? 0 ),
							'ms'          => (int) ( $result['ms'] ?? 0 ),
							'mobile_ms'   => (int) ( $result['mobile_ms'] ?? 0 ),
							'cache_state' => substr( (string) ( $result['cache'] ?? '' ), 0, 12 ),
							'error'       => substr( (string) ( $result['error'] ?? '' ), 0, 191 ),
							'attempts'    => (int) $row->attempts + 1,
							'updated_at'  => $now,
						),
						array( 'id' => (int) $row->id )
					);

					if ( ! $retry && '' !== $row->job_id && 'refresh' !== $row->job_id ) {
						$jobs[ $row->job_id ][] = array(
							'url'    => $row->url,
							'status' => $result['status'],
							'code'   => (int) ( $result['code'] ?? 0 ),
							'ms'     => (int) ( $result['ms'] ?? 0 ),
							'cache'  => (string) ( $result['cache'] ?? '' ),
							'error'  => (string) ( $result['error'] ?? '' ),
						);
					}
				}

				if ( $jobs ) {
					self::report( $jobs );
				}
			}
		} finally {
			delete_transient( 'silo_warmup_lock' );
		}

		if ( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status = 'queued'" ) > 0 ) {
			self::schedule();
		}
	}

	/**
	 * Fetch a batch of URLs in parallel (desktop + mobile) with precise timings.
	 *
	 * @param object[] $rows Queue rows.
	 * @return array<int,array> Result per row ID.
	 */
	private static function fetch( array $rows ): array {
		if ( ! function_exists( 'curl_multi_init' ) ) {
			return self::fetch_sequential( $rows );
		}

		$token   = Silo_Settings::warm_token();
		$verify  = (bool) apply_filters( 'https_local_ssl_verify', false ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Same policy WordPress core applies to loopback requests.
		$multi   = curl_multi_init(); // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_multi_init -- Parallel loopback warmup with per-request timing.
		$handles = array();
		$headers = array();

		foreach ( $rows as $row ) {
			foreach ( array(
				'desktop' => self::UA_DESKTOP,
				'mobile'  => self::UA_MOBILE,
			) as $device => $agent ) {
				$key             = (int) $row->id . ':' . $device;
				$headers[ $key ] = array();
				// phpcs:disable WordPress.WP.AlternativeFunctions -- Parallel loopback warmup needs curl_multi for per-request timing.
				$handle = curl_init( $row->url );
				curl_setopt_array(
					$handle,
					array(
						CURLOPT_RETURNTRANSFER => true,
						CURLOPT_FOLLOWLOCATION => false,
						CURLOPT_TIMEOUT        => 25,
						CURLOPT_CONNECTTIMEOUT => 8,
						CURLOPT_USERAGENT      => $agent,
						CURLOPT_ENCODING       => '',
						CURLOPT_SSL_VERIFYPEER => $verify,
						CURLOPT_SSL_VERIFYHOST => $verify ? 2 : 0,
						CURLOPT_HTTPHEADER     => array( 'X-Silo-Warmup: ' . $token, 'Accept: text/html,application/xhtml+xml' ),
						CURLOPT_HEADERFUNCTION => static function ( $curl, $line ) use ( &$headers, $key ) {
							$parts = explode( ':', $line, 2 );
							if ( 2 === count( $parts ) ) {
								$headers[ $key ][ strtolower( trim( $parts[0] ) ) ] = trim( $parts[1] );
							}
							return strlen( $line );
						},
					)
				);
				curl_multi_add_handle( $multi, $handle );
				// phpcs:enable WordPress.WP.AlternativeFunctions
				$handles[ $key ] = $handle;
			}
		}

		// phpcs:disable WordPress.WP.AlternativeFunctions -- Parallel loopback warmup needs curl_multi for per-request timing.
		do {
			$status = curl_multi_exec( $multi, $active );
			if ( $active ) {
				curl_multi_select( $multi, 1.0 );
			}
		} while ( $active && CURLM_OK === $status );

		$raw = array();
		foreach ( $handles as $key => $handle ) {
			$raw[ $key ] = array(
				'code'  => (int) curl_getinfo( $handle, CURLINFO_RESPONSE_CODE ),
				'ms'    => (int) round( (float) curl_getinfo( $handle, CURLINFO_TOTAL_TIME ) * 1000 ),
				'error' => curl_error( $handle ),
				'cache' => strtoupper( (string) ( $headers[ $key ]['x-silo-cache'] ?? '' ) ),
			);
			curl_multi_remove_handle( $multi, $handle );
			curl_close( $handle );
		}
		curl_multi_close( $multi );
		// phpcs:enable WordPress.WP.AlternativeFunctions

		$results = array();
		foreach ( $rows as $row ) {
			$desktop = $raw[ (int) $row->id . ':desktop' ];
			$mobile  = $raw[ (int) $row->id . ':mobile' ];

			$results[ (int) $row->id ] = self::classify( $desktop, $mobile );
		}
		return $results;
	}

	/**
	 * Fallback for hosts without the curl extension.
	 *
	 * @param object[] $rows Queue rows.
	 */
	private static function fetch_sequential( array $rows ): array {
		$token   = Silo_Settings::warm_token();
		$results = array();
		foreach ( $rows as $row ) {
			$pair = array();
			foreach ( array(
				'desktop' => self::UA_DESKTOP,
				'mobile'  => self::UA_MOBILE,
			) as $device => $agent ) {
				$started  = microtime( true );
				$response = wp_remote_get(
					$row->url,
					array(
						'timeout'     => 25,
						'redirection' => 0,
						'user-agent'  => $agent,
						'sslverify'   => (bool) apply_filters( 'https_local_ssl_verify', false ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core filter for loopback requests.
						'headers'     => array( 'X-Silo-Warmup' => $token ),
					)
				);

				$pair[ $device ] = array(
					'code'  => is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response ),
					'ms'    => (int) round( ( microtime( true ) - $started ) * 1000 ),
					'error' => is_wp_error( $response ) ? $response->get_error_message() : '',
					'cache' => is_wp_error( $response ) ? '' : strtoupper( (string) wp_remote_retrieve_header( $response, 'x-silo-cache' ) ),
				);
			}
			$results[ (int) $row->id ] = self::classify( $pair['desktop'], $pair['mobile'] );
		}
		return $results;
	}

	/**
	 * Turn raw responses into a queue status.
	 *
	 * @param array $desktop Desktop.
	 * @param array $mobile Mobile.
	 */
	private static function classify( array $desktop, array $mobile ): array {
		$result = array(
			'code'      => $desktop['code'],
			'ms'        => $desktop['ms'],
			'mobile_ms' => $mobile['ms'],
			'cache'     => $desktop['cache'],
			'error'     => $desktop['error'],
		);

		if ( 200 === $desktop['code'] && in_array( $desktop['cache'], array( 'WARM', 'MISS', 'HIT' ), true ) ) {
			$result['status'] = 'warm';
		} elseif ( 200 === $desktop['code'] && '' === $desktop['cache'] && 'coexist' === Silo_Compat::mode() ) {
			// Another plugin serves pages: this request primed its cache.
			$result['status'] = 'warm';
			$result['cache']  = 'PRIMED';
		} elseif ( 200 === $desktop['code'] ) {
			$result['status'] = 'skipped';
			$result['error']  = 'BYPASS' === $desktop['cache'] ? 'Bypassed (session boundary)' : 'Not a cacheable WooCommerce page';
		} else {
			$result['status'] = 'failed';
			if ( '' === $result['error'] ) {
				$result['error'] = $desktop['code'] >= 300 && $desktop['code'] < 400 ? 'Redirected (HTTP ' . $desktop['code'] . ')' : 'HTTP ' . $desktop['code'];
			}
		}
		return $result;
	}

	/**
	 * Report per-URL results and job totals to Silo; close out finished jobs locally.
	 *
	 * @param array<string,array> $jobs New results grouped by job ID.
	 */
	private static function report( array $jobs ): void {
		global $wpdb;
		$table   = self::table();
		$payload = array();

		foreach ( $jobs as $job_id => $results ) {
			$counts = $wpdb->get_row( $wpdb->prepare( "SELECT COUNT(*) AS total, SUM(status IN ('queued','warming')) AS pending, SUM(status = 'warm') AS warm, SUM(status = 'failed') AS failed, SUM(status = 'skipped') AS skipped, MIN(created_at) AS started FROM {$table} WHERE job_id = %s", $job_id ), ARRAY_A );

			$pending = (int) ( $counts['pending'] ?? 0 );
			$warm    = (int) ( $counts['warm'] ?? 0 );
			$failed  = (int) ( $counts['failed'] ?? 0 );
			$status  = $pending > 0 ? 'running' : ( 0 === $failed ? 'completed' : ( $warm > 0 ? 'partial' : 'failed' ) );

			$payload[] = array(
				'job_id'  => (string) $job_id,
				'status'  => $status,
				'total'   => (int) ( $counts['total'] ?? 0 ),
				'done'    => $warm + (int) ( $counts['skipped'] ?? 0 ),
				'failed'  => $failed,
				'results' => $results,
			);

			if ( 'running' !== $status ) {
				Silo_Log::complete_warm_job( (string) $job_id, 'failed' === $status ? 'failed' : 'warm' );
			}
		}

		Silo_Api::post( '/api/warmup/progress', array( 'jobs' => $payload ), 10 );
	}

	/**
	 * Queue counters for heartbeat and UI.
	 */
	public static function counts(): array {
		global $wpdb;
		$table = self::table();
		$since = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT SUM(status = 'queued') AS queued, SUM(status = 'warming') AS warming, SUM(status = 'warm' AND updated_at >= %s) AS warm_24h, SUM(status = 'failed' AND updated_at >= %s) AS failed_24h, AVG(CASE WHEN status = 'warm' AND updated_at >= %s THEN ms END) AS avg_ms FROM {$table}", $since, $since, $since ), ARRAY_A );

		return array(
			'queued'     => (int) ( $row['queued'] ?? 0 ),
			'warming'    => (int) ( $row['warming'] ?? 0 ),
			'warm_24h'   => (int) ( $row['warm_24h'] ?? 0 ),
			'failed_24h' => (int) ( $row['failed_24h'] ?? 0 ),
			'avg_ms'     => (int) round( (float) ( $row['avg_ms'] ?? 0 ) ),
		);
	}

	/**
	 * Active queue plus recent results for the admin UI.
	 *
	 * @param int $recent Recent.
	 */
	public static function snapshot( int $recent = 40 ): array {
		global $wpdb;
		$table  = self::table();
		$active = (array) $wpdb->get_results( "SELECT id, job_id, url, status, attempts, created_at FROM {$table} WHERE status IN ('warming','queued') ORDER BY FIELD(status,'warming','queued'), priority ASC, id ASC LIMIT 50", ARRAY_A );
		$done   = (array) $wpdb->get_results( $wpdb->prepare( "SELECT id, job_id, url, status, http_code, ms, mobile_ms, cache_state, error, updated_at FROM {$table} WHERE status IN ('warm','failed','skipped') ORDER BY updated_at DESC, id DESC LIMIT %d", $recent ), ARRAY_A );

		foreach ( $done as &$row ) {
			$row['updated_at'] = mysql_to_rfc3339( (string) $row['updated_at'] );
		}
		unset( $row );

		return array(
			'active' => $active,
			'recent' => $done,
			'counts' => self::counts(),
		);
	}

	/**
	 * Housekeeping: recover stuck rows, drop old history.
	 */
	public static function maintenance(): void {
		global $wpdb;
		$table = self::table();
		$wpdb->query( $wpdb->prepare( "UPDATE {$table} SET status = 'queued' WHERE status = 'warming' AND updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - 5 * MINUTE_IN_SECONDS ) ) );
		$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE status IN ('warm','failed','skipped') AND updated_at < %s", gmdate( 'Y-m-d H:i:s', time() - 2 * DAY_IN_SECONDS ) ) );
		if ( (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE status = 'queued'" ) > 0 ) {
			self::schedule();
		}
	}
}
