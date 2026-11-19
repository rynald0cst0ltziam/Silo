<?php
/**
 * Warmup: requests URLs to populate the cache.
 * Uses wp_remote_get for WP 6.6+ compatibility (not Requests directly).
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Warmup {

	private static ?self $instance = null;
	private int $concurrency       = 5;
	private int $timeout           = 15;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function warm_urls( array $urls ): int {
		if ( empty( $urls ) ) {
			return 0;
		}
		if ( get_option( 'silo_warmup_enabled', '1' ) !== '1' ) {
			return 0;
		}

		$config = get_option( 'silo_config', array() );
		$limit  = $config['limits']['warmup_urls_per_event'] ?? 50;
		$urls   = array_slice( $urls, 0, $limit );

		$warmed = 0;
		$chunks = array_chunk( $urls, $this->concurrency );

		foreach ( $chunks as $chunk ) {
			foreach ( $chunk as $url ) {
				$response = wp_remote_get( $url, array(
					'timeout'    => $this->timeout,
					'user-agent' => 'Silo-Warmup/' . SILO_VERSION,
					'headers'    => array(
						'X-Silo-Warmup' => '1',
					),
				) );

				$ok = ! is_wp_error( $response ) && wp_remote_retrieve_response_code( $response ) === 200;
				if ( $ok ) {
					$warmed++;
				}
				$this->log_warmup( $url, $ok ? 'ok' : 'failed' );
			}
		}

		return $warmed;
	}

	private function log_warmup( string $url, string $status ): void {
		$log_file = SILO_CACHE_DIR . '.warmup.log';
		$line     = gmdate( 'Y-m-d H:i:s' ) . '|' . $url . '|' . $status . "\n";
		file_put_contents( $log_file, $line, FILE_APPEND | LOCK_EX ); // phpcs:ignore

		if ( wp_rand( 1, 20 ) === 1 && file_exists( $log_file ) ) {
			$lines = file( $log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
			if ( $lines && count( $lines ) > 500 ) {
				$lines = array_slice( $lines, -500 );
				file_put_contents( $log_file, implode( "\n", $lines ) . "\n", LOCK_EX ); // phpcs:ignore
			}
		}
	}
}
