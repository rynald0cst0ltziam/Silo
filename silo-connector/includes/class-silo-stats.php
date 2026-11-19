<?php
/**
 * Hit/miss/bypass counters shared with the drop-in.
 *
 * Counters are cumulative within an epoch. Silo computes deltas itself from the
 * cumulative values, so a lost heartbeat never loses traffic data. Resetting
 * (purge all) starts a new epoch, which both sides treat as a clean slate.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stats file access.
 */
class Silo_Stats {

	/**
	 * File.
	 */
	public static function file(): string {
		return Silo_Settings::site_dir() . 'stats.json';
	}

	/**
	 * Read.
	 */
	public static function read(): array {
		$file = self::file();
		if ( ! is_file( $file ) ) {
			return self::reset();
		}

		// phpcs:disable WordPress.WP.AlternativeFunctions
		$handle = fopen( $file, 'r' );
		$stats  = null;
		if ( $handle ) {
			if ( flock( $handle, LOCK_SH ) ) {
				$stats = json_decode( (string) stream_get_contents( $handle ), true );
				flock( $handle, LOCK_UN );
			}
			fclose( $handle );
		}
		// phpcs:enable

		return is_array( $stats ) && ! empty( $stats['epoch'] ) ? wp_parse_args( $stats, silo_stats_blank() ) : self::reset();
	}

	/**
	 * Reset.
	 */
	public static function reset(): array {
		$stats = silo_stats_blank();
		$dir   = Silo_Settings::site_dir();
		if ( wp_mkdir_p( $dir ) ) {
			// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			file_put_contents( $dir . 'stats.json', (string) wp_json_encode( $stats ), LOCK_EX );
		}
		return $stats;
	}

	/**
	 * Bump.
	 *
	 * @param array $increments Increments.
	 */
	public static function bump( array $increments ): void {
		silo_stats_bump( Silo_Settings::site_dir(), $increments );
	}

	/**
	 * Stats with derived values for display and reporting.
	 */
	public static function summary(): array {
		$stats   = self::read();
		$served  = (int) $stats['hits'] + (int) $stats['misses'];
		$hit_avg = $stats['hit_n'] > 0 ? (int) round( $stats['hit_ms'] / $stats['hit_n'] ) : 0;
		$miss_av = $stats['miss_n'] > 0 ? (int) round( $stats['miss_ms'] / $stats['miss_n'] ) : 0;

		$by_type = array();
		foreach ( array( 'product', 'archive', 'shop', 'front' ) as $type ) {
			$hits   = (int) ( $stats[ 'hit_' . $type ] ?? 0 );
			$misses = (int) ( $stats[ 'miss_' . $type ] ?? 0 );
			if ( $hits + $misses > 0 ) {
				$by_type[ $type ] = array(
					'hits'     => $hits,
					'misses'   => $misses,
					'hit_rate' => round( $hits / ( $hits + $misses ) * 100, 1 ),
				);
			}
		}
		$reasons = array();
		foreach ( $stats as $key => $value ) {
			if ( str_starts_with( (string) $key, 'bypass_' ) ) {
				$reasons[ substr( (string) $key, 7 ) ] = (int) $value;
			}
		}
		arsort( $reasons );

		return array_merge(
			$stats,
			array(
				'by_type'        => $by_type,
				'bypass_reasons' => $reasons,
				'total'          => $served + (int) $stats['bypass'],
				'hit_rate'       => $served > 0 ? round( ( (int) $stats['hits'] / $served ) * 100, 1 ) : 0.0,
				'avg_hit_ms'     => $hit_avg,
				'avg_miss_ms'    => $miss_av,
				'api_hit_rate'   => ( $stats['api_hits'] + $stats['api_misses'] ) > 0 ? round( ( $stats['api_hits'] / ( $stats['api_hits'] + $stats['api_misses'] ) ) * 100, 1 ) : 0.0,
			)
		);
	}
}
