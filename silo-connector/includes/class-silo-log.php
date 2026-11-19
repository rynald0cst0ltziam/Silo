<?php
/**
 * Invalidation log: every catalog event, what was purged locally, what Silo resolved,
 * and how warmup went. Stored in {prefix}silo_events.
 *
 * States: queued → purged | warming → warm, or local (Silo unreachable, purged on-site),
 * limited (plan limit reached, purged on-site), failed, done (system entries).
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery

/**
 * Event log table access.
 */
class Silo_Log {

	const KEEP_ROWS = 2000;

	public static function table(): string {
		global $wpdb;
		return $wpdb->prefix . 'silo_events';
	}

	public static function insert( array $row ): int {
		global $wpdb;
		$now = current_time( 'mysql', true );

		$data = array(
			'ref'         => $row['ref'] ?? self::ref(),
			'type'        => substr( (string) ( $row['type'] ?? 'system.note' ), 0, 48 ),
			'object'      => mb_substr( (string) ( $row['object'] ?? '' ), 0, 191 ),
			'detail'      => mb_substr( (string) ( $row['detail'] ?? '' ), 0, 191 ),
			'state'       => (string) ( $row['state'] ?? 'queued' ),
			'purged'      => (int) ( $row['purged'] ?? 0 ),
			'warm_total'  => (int) ( $row['warm_total'] ?? 0 ),
			'duration_ms' => (int) ( $row['duration_ms'] ?? 0 ),
			'local_ms'    => (int) ( $row['local_ms'] ?? 0 ),
			'payload'     => isset( $row['payload'] ) ? (string) wp_json_encode( $row['payload'] ) : null,
			'scope'       => isset( $row['scope'] ) ? (string) wp_json_encode( $row['scope'] ) : null,
			'created_at'  => $now,
			'updated_at'  => $now,
		);

		$wpdb->insert( self::table(), $data );
		return (int) $wpdb->insert_id;
	}

	public static function update( int $id, array $changes ): void {
		global $wpdb;
		foreach ( array( 'payload', 'scope' ) as $json ) {
			if ( isset( $changes[ $json ] ) && ! is_string( $changes[ $json ] ) ) {
				$changes[ $json ] = (string) wp_json_encode( $changes[ $json ] );
			}
		}
		$changes['updated_at'] = current_time( 'mysql', true );
		$wpdb->update( self::table(), $changes, array( 'id' => $id ) );
	}

	public static function ref(): string {
		return str_replace( '-', '', wp_generate_uuid4() );
	}

	public static function queued( int $limit = 25 ): array {
		global $wpdb;
		$table = self::table();
		return (array) $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} WHERE state = 'queued' ORDER BY id ASC LIMIT %d", $limit ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	public static function count_state( string $state ): int {
		global $wpdb;
		$table = self::table();
		return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$table} WHERE state = %s", $state ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	}

	public static function oldest_queued_age(): int {
		global $wpdb;
		$table  = self::table();
		$oldest = $wpdb->get_var( "SELECT MIN(created_at) FROM {$table} WHERE state = 'queued'" ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $oldest ? max( 0, time() - (int) strtotime( $oldest . ' UTC' ) ) : 0;
	}

	/**
	 * Events in the last 24 hours that touched the catalog (system entries excluded).
	 */
	public static function count_last_day(): array {
		global $wpdb;
		$table = self::table();
		$since = gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT COUNT(*) AS events, COALESCE(SUM(purged),0) AS purged, COALESCE(SUM(warm_total),0) AS warmed, COALESCE(AVG(NULLIF(duration_ms,0)),0) AS avg_ms FROM {$table} WHERE created_at >= %s AND type NOT LIKE %s", $since, 'system.%' ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared

		return array(
			'events' => (int) ( $row['events'] ?? 0 ),
			'purged' => (int) ( $row['purged'] ?? 0 ),
			'warmed' => (int) ( $row['warmed'] ?? 0 ),
			'avg_ms' => (int) round( (float) ( $row['avg_ms'] ?? 0 ) ),
		);
	}

	/**
	 * Rows for the admin UI, newest first.
	 */
	public static function recent( int $limit = 30, string $group = '', int $before_id = 0, bool $with_detail = false ): array {
		global $wpdb;
		$table  = self::table();
		$where  = array( '1=1' );
		$params = array();

		$groups = array(
			'stock'   => array( 'stock.%', 'order.%' ),
			'price'   => array( 'price.%', 'sale.%' ),
			'product' => array( 'product.%', 'review.%' ),
			'terms'   => array( 'term.%' ),
			'system'  => array( 'system.%', 'purge.%' ),
		);
		if ( isset( $groups[ $group ] ) ) {
			$like = array();
			foreach ( $groups[ $group ] as $pattern ) {
				$like[]   = 'type LIKE %s';
				$params[] = $pattern;
			}
			$where[] = '(' . implode( ' OR ', $like ) . ')';
		}
		if ( $before_id > 0 ) {
			$where[]  = 'id < %d';
			$params[] = $before_id;
		}
		$params[] = $limit;

		$columns = $with_detail ? '*' : 'id, ref, type, object, detail, state, purged, warm_total, duration_ms, local_ms, saas_event_id, warm_job_id, created_at, updated_at';
		$sql     = "SELECT {$columns} FROM {$table} WHERE " . implode( ' AND ', $where ) . ' ORDER BY id DESC LIMIT %d';
		$rows    = (array) $wpdb->get_results( $wpdb->prepare( $sql, $params ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		return array_map( array( __CLASS__, 'present' ), $rows );
	}

	public static function find( int $id ): ?array {
		global $wpdb;
		$table = self::table();
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $id ), ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		return $row ? self::present( $row ) : null;
	}

	/**
	 * Mark every event whose warmup job finished.
	 */
	public static function complete_warm_job( string $job_id, string $state ): void {
		global $wpdb;
		if ( '' === $job_id ) {
			return;
		}
		$wpdb->update(
			self::table(),
			array(
				'state'      => $state,
				'updated_at' => current_time( 'mysql', true ),
			),
			array(
				'warm_job_id' => $job_id,
				'state'       => 'warming',
			)
		);
	}

	public static function prune(): void {
		global $wpdb;
		$table = self::table();
		$cut   = (int) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} ORDER BY id DESC LIMIT 1 OFFSET %d", self::KEEP_ROWS ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		if ( $cut > 0 ) {
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$table} WHERE id <= %d", $cut ) ); // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		}
	}

	/**
	 * Shape a row for JSON output.
	 */
	private static function present( array $row ): array {
		$out = array(
			'id'          => (int) $row['id'],
			'ref'         => (string) $row['ref'],
			'type'        => (string) $row['type'],
			'object'      => (string) $row['object'],
			'detail'      => (string) $row['detail'],
			'state'       => (string) $row['state'],
			'purged'      => (int) $row['purged'],
			'warm_total'  => (int) $row['warm_total'],
			'duration_ms' => (int) $row['duration_ms'],
			'local_ms'    => (int) $row['local_ms'],
			'event_id'    => (string) $row['saas_event_id'],
			'warm_job_id' => (string) $row['warm_job_id'],
			'created_at'  => mysql_to_rfc3339( (string) $row['created_at'] ),
			'updated_at'  => mysql_to_rfc3339( (string) $row['updated_at'] ),
		);
		if ( array_key_exists( 'payload', $row ) ) {
			$out['payload'] = $row['payload'] ? json_decode( (string) $row['payload'], true ) : null;
			$out['scope']   = $row['scope'] ? json_decode( (string) $row['scope'], true ) : null;
		}
		return $out;
	}
}
