<?php
/**
 * Config applier: receives config from SaaS, writes it to options, applies purge/warm.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Config_Applier {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function handle_apply( \WP_REST_Request $request ): \WP_REST_Response {
		$config = $request->get_param( 'config' );
		$purge  = $request->get_param( 'purge' );
		$warm   = $request->get_param( 'warm' );

		$results = array(
			'config_applied' => false,
			'purged'         => 0,
			'warmed'         => 0,
		);

		if ( $config && is_array( $config ) ) {
			$current         = get_option( 'silo_config', array() );
			$current_version = $current['version'] ?? 0;
			$new_version     = $config['version'] ?? 0;

			if ( $new_version >= $current_version ) {
				update_option( 'silo_config', $config, false );
				$results['config_applied'] = true;
				$results['config_version'] = $new_version;

				$this->ensure_dropin();
				$this->sync_hooks( $config );
			}
		}

		if ( $purge && is_array( $purge ) ) {
			$results['purged'] = silo()->page_cache()->purge_urls( $purge );
		}

		if ( $warm && is_array( $warm ) ) {
			$results['warmed'] = silo()->warmup()->warm_urls( $warm );
		}

		return new \WP_REST_Response( $results, 200 );
	}

	private function ensure_dropin(): void {
		$source = SILO_PLUGIN_DIR . 'advanced-cache.php';
		$dest   = WP_CONTENT_DIR . '/advanced-cache.php';

		if ( ! file_exists( $dest ) || ! str_contains( file_get_contents( $dest ), 'silo-connector' ) ) { // phpcs:ignore
			if ( file_exists( $source ) ) {
				copy( $source, $dest ); // phpcs:ignore
			}
		}
	}

	private function sync_hooks( array $config ): void {
		$required = $config['hooks_required'] ?? array();
		update_option( 'silo_required_hooks', $required, false );
	}
}
