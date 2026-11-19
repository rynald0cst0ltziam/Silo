<?php
/**
 * Health checks shown under WooCommerce → Silo → Status and reported in the heartbeat.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Environment checks.
 */
class Silo_Status {

	/**
	 * Active plugins whose page cache would fight Silo over the same URLs.
	 */
	public static function cache_conflicts(): array {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$plugins = array(
			'wp-rocket/wp-rocket.php'                     => 'WP Rocket',
			'w3-total-cache/w3-total-cache.php'           => 'W3 Total Cache',
			'wp-super-cache/wp-cache.php'                 => 'WP Super Cache',
			'litespeed-cache/litespeed-cache.php'         => 'LiteSpeed Cache',
			'wp-fastest-cache/wpFastestCache.php'         => 'WP Fastest Cache',
			'flying-press/flying-press.php'               => 'FlyingPress',
			'breeze/breeze.php'                           => 'Breeze',
			'sg-cachepress/sg-cachepress.php'             => 'SiteGround Optimizer',
			'wp-optimize/wp-optimize.php'                 => 'WP-Optimize',
			'hummingbird-performance/wp-hummingbird.php'  => 'Hummingbird',
			'nitropack/main.php'                          => 'NitroPack',
			'powered-cache/powered-cache.php'             => 'Powered Cache',
			'cache-enabler/cache-enabler.php'             => 'Cache Enabler',
			'comet-cache/comet-cache.php'                 => 'Comet Cache',
			'mamba-cache-for-woocommerce/mamba-cache.php' => 'Mamba Cache',
		);
		$found   = array();
		foreach ( $plugins as $file => $name ) {
			if ( is_plugin_active( $file ) ) {
				$found[] = $name;
			}
		}
		if ( 'foreign' === Silo_Installer::dropin_status() ) {
			$owner = Silo_Installer::foreign_dropin_owner();
			if ( ! in_array( $owner, $found, true ) ) {
				$found[] = $owner;
			}
		}
		return $found;
	}

	/**
	 * Compact health for the heartbeat.
	 */
	public static function compact(): array {
		return array(
			'dropin'     => Silo_Installer::dropin_status(),
			'wp_cache'   => defined( 'WP_CACHE' ) && WP_CACHE,
			'writable'   => wp_is_writable( silo_cache_root() ),
			'conflicts'  => self::cache_conflicts(),
			'page_cache' => (bool) Silo_Settings::get( 'page_cache' ),
			'store_api'  => (bool) Silo_Settings::get( 'store_api_cache' ),
			'warmup'     => (bool) Silo_Settings::get( 'warmup' ),
			'pretty'     => '' !== (string) get_option( 'permalink_structure' ),
			'scheduler'  => function_exists( 'as_enqueue_async_action' ),
			'auth_error' => (string) get_option( 'silo_auth_error', '' ),
			'mode'       => 'ours' === Silo_Installer::dropin_status() && defined( 'WP_CACHE' ) && WP_CACHE ? 'dropin' : 'late',
		);
	}

	/**
	 * Full check list. Live checks call Silo and the storefront.
	 *
	 * @param bool $live Live.
	 */
	public static function checks( bool $live = false ): array {
		$checks = array();
		$dropin = Silo_Installer::dropin_status();

		$hb_ok    = (int) get_option( 'silo_hb_ok', 0 );
		$hb_err   = (string) get_option( 'silo_hb_error', '' );
		$auth     = (string) get_option( 'silo_auth_error', '' );
		$checks[] = array(
			'id'     => 'connection',
			'label'  => __( 'Store key and connection', 'silo-connector' ),
			'state'  => '' !== $auth ? 'fail' : ( $hb_ok && time() - $hb_ok < 180 ? 'ok' : 'warn' ),
			'detail' => '' !== $auth ? $auth : ( $hb_ok ? sprintf( /* translators: %s: time ago */ __( 'Last heartbeat %s ago', 'silo-connector' ), human_time_diff( $hb_ok ) ) : ( $hb_err ? $hb_err : __( 'Waiting for the first heartbeat', 'silo-connector' ) ) ),
		);

		if ( $live ) {
			$response = Silo_Api::post( '/api/stores/handshake', self::handshake_payload(), 10 );
			$checks[] = array(
				'id'     => 'saas',
				'label'  => __( 'Outbound HTTPS to Silo', 'silo-connector' ),
				'state'  => ! is_wp_error( $response ) && 200 === $response['code'] ? 'ok' : 'fail',
				'detail' => ! is_wp_error( $response ) && 200 === $response['code'] ? sprintf( /* translators: %d: milliseconds */ __( 'Reachable · %d ms round trip', 'silo-connector' ), $response['ms'] ) : Silo_Api::error_message( $response ),
			);
		}

		$dropin_labels = array(
			'ours'    => __( 'Installed — cached pages are served before WordPress loads', 'silo-connector' ),
			'stale'   => __( 'Points to an old plugin location — reactivate Silo to rewrite it', 'silo-connector' ),
			/* translators: %s: plugin name */
			'foreign' => sprintf( __( 'Owned by %s — Silo serves from plugins_loaded instead (slower)', 'silo-connector' ), Silo_Installer::foreign_dropin_owner() ),
			'missing' => __( 'Not installed — wp-content is not writable', 'silo-connector' ),
		);
		$checks[]      = array(
			'id'     => 'dropin',
			'label'  => __( 'advanced-cache.php drop-in', 'silo-connector' ),
			'state'  => 'ours' === $dropin ? 'ok' : ( 'missing' === $dropin ? 'fail' : 'warn' ),
			'detail' => $dropin_labels[ $dropin ],
		);

		$wp_cache = defined( 'WP_CACHE' ) && WP_CACHE;
		$checks[] = array(
			'id'     => 'wp_cache',
			'label'  => __( 'WP_CACHE constant', 'silo-connector' ),
			'state'  => $wp_cache ? 'ok' : 'warn',
			'detail' => $wp_cache ? __( 'Enabled in wp-config.php', 'silo-connector' ) : __( "Disabled — add define( 'WP_CACHE', true ); to wp-config.php", 'silo-connector' ),
		);

		$writable = wp_is_writable( silo_cache_root() );
		$checks[] = array(
			'id'     => 'writable',
			'label'  => __( 'Cache directory', 'silo-connector' ),
			'state'  => $writable ? 'ok' : 'fail',
			'detail' => $writable ? 'wp-content/cache/silo/' : __( 'wp-content/cache/silo/ is not writable by PHP', 'silo-connector' ),
		);

		$pretty   = '' !== (string) get_option( 'permalink_structure' );
		$checks[] = array(
			'id'     => 'permalinks',
			'label'  => __( 'Pretty permalinks', 'silo-connector' ),
			'state'  => $pretty ? 'ok' : 'fail',
			'detail' => $pretty ? (string) get_option( 'permalink_structure' ) : __( 'Plain permalinks cannot be cached by path. Settings → Permalinks.', 'silo-connector' ),
		);

		$conflicts = self::cache_conflicts();
		$checks[]  = array(
			'id'     => 'conflicts',
			'label'  => __( 'Other page caches', 'silo-connector' ),
			'state'  => $conflicts ? 'warn' : 'ok',
			'detail' => $conflicts ? sprintf( /* translators: %s: plugin names */ __( '%s active — disable its page caching; keep its asset and CDN features', 'silo-connector' ), implode( ', ', $conflicts ) ) : __( 'None detected', 'silo-connector' ),
		);

		$scheduler = function_exists( 'as_enqueue_async_action' );
		$checks[]  = array(
			'id'     => 'scheduler',
			'label'  => __( 'Background processing', 'silo-connector' ),
			'state'  => $scheduler ? 'ok' : 'warn',
			'detail' => $scheduler ? __( 'Action Scheduler (WooCommerce)', 'silo-connector' ) : __( 'Falling back to WP-Cron', 'silo-connector' ),
		);

		$curl     = function_exists( 'curl_multi_init' );
		$checks[] = array(
			'id'     => 'curl',
			'label'  => __( 'Parallel warmup', 'silo-connector' ),
			'state'  => $curl ? 'ok' : 'warn',
			'detail' => $curl ? __( 'curl available', 'silo-connector' ) : __( 'curl missing — warmup runs sequentially', 'silo-connector' ),
		);

		$hpos     = class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		$checks[] = array(
			'id'     => 'hpos',
			'label'  => __( 'Order storage', 'silo-connector' ),
			'state'  => 'ok',
			'detail' => $hpos ? __( 'HPOS — fully supported', 'silo-connector' ) : __( 'Legacy posts storage — fully supported', 'silo-connector' ),
		);

		$wc_ok    = defined( 'WC_VERSION' ) && version_compare( WC_VERSION, '8.2', '>=' );
		$checks[] = array(
			'id'     => 'woocommerce',
			'label'  => __( 'WooCommerce', 'silo-connector' ),
			'state'  => $wc_ok ? 'ok' : 'fail',
			'detail' => defined( 'WC_VERSION' ) ? WC_VERSION : __( 'Not active', 'silo-connector' ),
		);

		if ( $live ) {
			$checks[] = self::loopback_check();
		}

		return $checks;
	}

	/**
	 * Handshake payload.
	 */
	public static function handshake_payload(): array {
		return array(
			'site_url'          => site_url(),
			'home_url'          => home_url( '/' ),
			'connector_version' => SILO_VERSION,
			'wp_version'        => get_bloginfo( 'version' ),
			'wc_version'        => defined( 'WC_VERSION' ) ? WC_VERSION : '',
			'php_version'       => PHP_VERSION,
		);
	}

	/**
	 * Request the shop page twice like an anonymous shopper: expect MISS (or HIT), then HIT.
	 */
	public static function loopback_check(): array {
		$url = function_exists( 'wc_get_page_permalink' ) ? (string) wc_get_page_permalink( 'shop' ) : home_url( '/' );
		$seq = array();
		for ( $i = 0; $i < 2; $i++ ) {
			$response = wp_remote_get(
				add_query_arg( 'orderby', 'menu_order', $url ),
				array(
					'timeout'     => 15,
					'redirection' => 0,
					'sslverify'   => (bool) apply_filters( 'https_local_ssl_verify', false ), // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WordPress core filter for loopback requests.
					'user-agent'  => 'Mozilla/5.0 (Windows NT 10.0) SiloLoopbackTest/2',
					'cookies'     => array(),
				)
			);
			if ( is_wp_error( $response ) ) {
				return array(
					'id'     => 'loopback',
					'label'  => __( 'Cache round trip', 'silo-connector' ),
					'state'  => 'fail',
					'detail' => $response->get_error_message(),
				);
			}
			$state = strtoupper( (string) wp_remote_retrieve_header( $response, 'x-silo-cache' ) );
			$seq[] = '' !== $state ? $state : 'none';
		}

		$ok = 'HIT' === $seq[1];
		update_option(
			'silo_loopback',
			array(
				'seq' => $seq,
				'ok'  => $ok,
				'at'  => time(),
			),
			false
		);

		return array(
			'id'     => 'loopback',
			'label'  => __( 'Cache round trip', 'silo-connector' ),
			'state'  => $ok ? 'ok' : 'warn',
			'detail' => sprintf( /* translators: 1: first response state, 2: second response state */ __( 'Shop page: %1$s → %2$s', 'silo-connector' ), $seq[0], $seq[1] ) . ( $ok ? '' : ' — ' . __( 'expected HIT on the second request', 'silo-connector' ) ),
		);
	}
}
