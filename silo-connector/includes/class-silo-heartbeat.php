<?php
/**
 * Heartbeat: cumulative cache counters, inventory, queue depth and environment health,
 * pushed to Silo every minute by cron, every 30 seconds while the storefront has
 * traffic, and on demand while either dashboard is open.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Heartbeat sender.
 */
class Silo_Heartbeat {

	const HOOK = 'silo_heartbeat';

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_filter( 'cron_schedules', array( __CLASS__, 'schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
		add_action( self::HOOK, array( __CLASS__, 'cron' ) );
		add_action( 'shutdown', array( __CLASS__, 'piggyback' ), 1000 );
	}

	/**
	 * Schedules.
	 *
	 * @param array $schedules Cron schedules.
	 */
	public static function schedules( $schedules ): array {
		$schedules['silo_minute'] = array(
			'interval' => 60,
			'display'  => __( 'Every minute (Silo heartbeat)', 'silo-connector' ),
		);
		return $schedules;
	}

	/**
	 * Schedule.
	 */
	public static function schedule(): void {
		add_filter( 'cron_schedules', array( __CLASS__, 'schedules' ) ); // phpcs:ignore WordPress.WP.CronInterval.CronSchedulesInterval
		if ( ! wp_next_scheduled( self::HOOK ) ) {
			wp_schedule_event( time() + 30, 'silo_minute', self::HOOK );
		}
	}

	/**
	 * Unschedule.
	 */
	public static function unschedule(): void {
		wp_clear_scheduled_hook( self::HOOK );
	}

	/**
	 * Cron.
	 */
	public static function cron(): void {
		if ( ! Silo_Settings::is_connected() ) {
			return;
		}
		self::send( true );
		Silo_Events::maybe_kick();
		Silo_Page_Cache::drain_refresh_queue();
		Silo_Warmup::maintenance();
		if ( 0 === wp_rand( 0, 59 ) ) {
			Silo_Log::prune();
		}
	}

	/**
	 * Storefront traffic keeps the heartbeat fresh without waiting for cron.
	 */
	public static function piggyback(): void {
		if ( ! Silo_Settings::is_connected() || is_admin() || wp_doing_cron() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return;
		}
		if ( time() - (int) get_option( 'silo_hb_last', 0 ) < 30 ) {
			return;
		}
		self::send( false );
		Silo_Page_Cache::drain_refresh_queue();
	}

	/**
	 * Payload.
	 */
	public static function payload(): array {
		$stats     = Silo_Stats::summary();
		$inventory = Silo_Page_Cache::inventory();

		return array(
			'stats'             => array_merge(
				$stats,
				array(
					'cached_pages' => $inventory['pages'],
					'cache_bytes'  => $inventory['bytes'],
					'api_entries'  => $inventory['api'],
				)
			),
			'warmup'            => Silo_Warmup::counts(),
			'events'            => array(
				'queued' => Silo_Log::count_state( 'queued' ),
			),
			'env'               => Silo_Status::compact(),
			'scan'              => Silo_Scanner::is_running() ? Silo_Scanner::public_state() : null,
			'connector_version' => SILO_VERSION,
			'config_version'    => (int) ( Silo_Settings::remote_config()['version'] ?? 0 ),
			'site'              => array(
				'home' => home_url( '/' ),
				'wp'   => get_bloginfo( 'version' ),
				'wc'   => defined( 'WC_VERSION' ) ? WC_VERSION : '',
				'php'  => PHP_VERSION,
			),
			'sent_at'           => time(),
		);
	}

	/**
	 * Send now. Blocking sends also pick up a newer config if Silo has one.
	 *
	 * @param bool $blocking Blocking.
	 */
	public static function send( bool $blocking ): ?array {
		update_option( 'silo_hb_last', time(), true );
		$response = Silo_Api::post( '/api/stores/heartbeat', self::payload(), $blocking ? 10 : 1, $blocking );

		if ( ! $blocking ) {
			return null;
		}
		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			update_option( 'silo_hb_error', Silo_Api::error_message( $response ), false );
			if ( ! is_wp_error( $response ) && in_array( $response['code'], array( 401, 403 ), true ) ) {
				Silo_Settings::set_auth_error( Silo_Api::error_message( $response ) );
			}
			return null;
		}

		update_option( 'silo_hb_ok', time(), false );
		update_option( 'silo_hb_ms', (int) $response['ms'], false );
		delete_option( 'silo_hb_error' );
		Silo_Settings::set_auth_error( '' );

		if ( ! empty( $response['body']['config'] ) && is_array( $response['body']['config'] ) ) {
			Silo_Settings::apply_remote_config( $response['body']['config'] );
		}
		if ( ! empty( $response['body']['store'] ) && is_array( $response['body']['store'] ) ) {
			update_option( 'silo_store', array_merge( Silo_Settings::store(), $response['body']['store'] ), false );
		}
		return $response;
	}
}
