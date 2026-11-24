<?php
/**
 * Working alongside other caches and page builders.
 *
 * Silo never asks a store to remove WP Rocket, LiteSpeed, a host cache or a CDN. Two modes:
 *
 * - "silo":    no other full-page cache is active, Silo serves cached pages itself.
 * - "coexist": another plugin already serves cached pages. Silo leaves page serving to it and
 *              becomes its WooCommerce brain: every stock, price, sale and order change purges
 *              exactly the right URLs in that cache too, then Silo rewarms them through it.
 *              Store API caching, fragments and the invalidation log keep working.
 *
 * In both modes, host caches (Nginx Helper, WP Engine, Kinsta, Pantheon, SpinupWP) and Cloudflare
 * are purged for the same URLs, so no layer in front of WordPress keeps a stale copy.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Other caches and builders.
 */
class Silo_Compat {

	const OPTION_CLOUDFLARE = 'silo_cloudflare';

	/**
	 * Re-entrancy guard: purging another cache can fire its own "cache cleared" hooks.
	 *
	 * @var bool
	 */
	private static $purging = false;

	/**
	 * Full-page cache plugins: plugin file => [name, URL purge supported].
	 */
	public static function page_cache_plugins(): array {
		return array(
			'wp-rocket/wp-rocket.php'                     => array( 'WP Rocket', true ),
			'litespeed-cache/litespeed-cache.php'         => array( 'LiteSpeed Cache', true ),
			'w3-total-cache/w3-total-cache.php'           => array( 'W3 Total Cache', true ),
			'wp-super-cache/wp-cache.php'                 => array( 'WP Super Cache', true ),
			'wp-fastest-cache/wpFastestCache.php'         => array( 'WP Fastest Cache', true ),
			'flying-press/flying-press.php'               => array( 'FlyingPress', true ),
			'sg-cachepress/sg-cachepress.php'             => array( 'SiteGround Optimizer', true ),
			'hummingbird-performance/wp-hummingbird.php'  => array( 'Hummingbird', true ),
			'cache-enabler/cache-enabler.php'             => array( 'Cache Enabler', true ),
			'breeze/breeze.php'                           => array( 'Breeze', false ),
			'wp-optimize/wp-optimize.php'                 => array( 'WP-Optimize', true ),
			'nitropack/main.php'                          => array( 'NitroPack', false ),
			'powered-cache/powered-cache.php'             => array( 'Powered Cache', false ),
			'comet-cache/comet-cache.php'                 => array( 'Comet Cache', false ),
			'swift-performance-lite/performance.php'      => array( 'Swift Performance', false ),
			'mamba-cache-for-woocommerce/mamba-cache.php' => array( 'Mamba Cache', false ),
		);
	}

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		// Re-evaluate the mode as soon as another cache plugin is switched on or off.
		add_action( 'activated_plugin', array( __CLASS__, 'refresh_mode' ), 20 );
		add_action( 'deactivated_plugin', array( __CLASS__, 'refresh_mode' ), 20 );

		// Someone cleared another cache by hand: clear Silo's copies too.
		foreach ( array( 'after_rocket_clean_domain', 'litespeed_purged_all', 'w3tc_flush_all', 'wp_cache_cleared', 'wpfc_delete_cache', 'cache_enabler_complete_cache_cleared', 'breeze_clear_all_cache' ) as $hook ) {
			add_action( $hook, array( __CLASS__, 'on_external_clear_all' ), 99 );
		}

		// Page builders.
		add_action( 'elementor/core/files/clear_cache', array( __CLASS__, 'on_builder_css_cleared' ) );
		add_action( 'fl_builder_cache_cleared', array( __CLASS__, 'on_builder_css_cleared' ) );
		add_action( 'fl_builder_after_save_layout', array( __CLASS__, 'on_builder_layout_saved' ), 20 );
		add_action( 'et_save_post', array( __CLASS__, 'on_builder_layout_saved' ), 20 );
	}

	// Detection.

	/**
	 * Active full-page caches: [ [ 'name' => …, 'urls' => bool ] ].
	 */
	public static function page_caches(): array {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
		$found = array();
		foreach ( self::page_cache_plugins() as $file => $info ) {
			if ( is_plugin_active( $file ) ) {
				$found[ $info[0] ] = array(
					'name' => $info[0],
					'urls' => $info[1],
				);
			}
		}
		if ( 'foreign' === Silo_Installer::dropin_status() ) {
			$owner = Silo_Installer::foreign_dropin_owner();
			if ( ! isset( $found[ $owner ] ) ) {
				$found[ $owner ] = array(
					'name' => $owner,
					'urls' => false,
				);
			}
		}
		return array_values( $found );
	}

	/**
	 * Host and CDN layers in front of WordPress that Silo purges in step.
	 */
	public static function edge_layers(): array {
		$layers = array();
		if ( defined( 'NGINX_HELPER_BASENAME' ) || isset( $GLOBALS['nginx_purger'] ) ) {
			$layers[] = 'Nginx Helper';
		}
		if ( class_exists( 'WpeCommon' ) ) {
			$layers[] = 'WP Engine';
		}
		if ( defined( 'KINSTAMU_VERSION' ) || isset( $GLOBALS['kinsta_cache'] ) ) {
			$layers[] = 'Kinsta';
		}
		if ( function_exists( 'pantheon_wp_clear_edge_paths' ) ) {
			$layers[] = 'Pantheon';
		}
		if ( function_exists( 'spinupwp_purge_url' ) ) {
			$layers[] = 'SpinupWP';
		}
		if ( self::cloudflare_ready() ) {
			$layers[] = 'Cloudflare';
		}
		return $layers;
	}

	/**
	 * Mode the store runs in right now.
	 */
	public static function mode(): string {
		$setting = (string) Silo_Settings::get( 'cache_mode' );
		if ( 'silo' === $setting || 'coexist' === $setting ) {
			return $setting;
		}
		return self::page_caches() ? 'coexist' : 'silo';
	}

	/**
	 * Name of the cache serving pages in coexist mode.
	 */
	public static function owner(): string {
		$caches = self::page_caches();
		return $caches ? (string) $caches[0]['name'] : '';
	}

	/**
	 * Rewrite the edge config when the effective mode changed. Switching modes drops Silo's
	 * cached pages so a later switch back never serves something old.
	 */
	public static function refresh_mode(): void {
		$mode = self::mode();
		$last = (string) get_option( 'silo_mode_last', '' );
		if ( $mode === $last ) {
			return;
		}
		update_option( 'silo_mode_last', $mode, false );
		Silo_Settings::write_edge_config();
		if ( '' !== $last ) {
			Silo_Page_Cache::purge_everything( false );
		}
	}

	/**
	 * Summary for the heartbeat, status screen and Silo dashboard.
	 */
	public static function summary(): array {
		return array(
			'mode'        => self::mode(),
			'setting'     => (string) Silo_Settings::get( 'cache_mode' ),
			'page_caches' => array_column( self::page_caches(), 'name' ),
			'edge'        => self::edge_layers(),
		);
	}

	// Purging other layers.

	/**
	 * Purge URLs in every other cache layer.
	 *
	 * @param string[] $urls Absolute URLs on this site.
	 */
	public static function purge_urls( array $urls ): void {
		if ( self::$purging || ! $urls ) {
			return;
		}
		self::$purging = true;
		try {
			foreach ( $urls as $url ) {
				self::purge_url_everywhere( (string) $url );
			}
			if ( function_exists( 'rocket_clean_files' ) ) {
				rocket_clean_files( $urls );
			}
			if ( function_exists( 'pantheon_wp_clear_edge_paths' ) ) {
				$paths = array();
				foreach ( $urls as $url ) {
					$paths[] = (string) wp_parse_url( $url, PHP_URL_PATH );
				}
				pantheon_wp_clear_edge_paths( array_values( array_unique( array_filter( $paths ) ) ) );
			}
			self::cloudflare_purge( $urls );
		} finally {
			self::$purging = false;
		}
	}

	/**
	 * Per-URL purge APIs.
	 *
	 * @param string $url URL.
	 */
	private static function purge_url_everywhere( string $url ): void {
		// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Calling other plugins' documented purge hooks.
		do_action( 'litespeed_purge_url', $url );
		do_action( 'cache_enabler_clear_page_cache_by_url', $url );
		// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound

		if ( function_exists( 'w3tc_flush_url' ) ) {
			w3tc_flush_url( $url );
		}
		if ( function_exists( 'wpsc_delete_url_cache' ) ) {
			wpsc_delete_url_cache( $url );
		}
		if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
			sg_cachepress_purge_cache( $url );
		}
		if ( class_exists( '\FlyingPress\Purge' ) && method_exists( '\FlyingPress\Purge', 'purge_url' ) ) {
			\FlyingPress\Purge::purge_url( $url );
		}
		if ( function_exists( 'spinupwp_purge_url' ) ) {
			spinupwp_purge_url( $url );
		}
		if ( isset( $GLOBALS['nginx_purger'] ) && is_object( $GLOBALS['nginx_purger'] ) && method_exists( $GLOBALS['nginx_purger'], 'purge_url' ) ) {
			$GLOBALS['nginx_purger']->purge_url( $url );
		}

		// Post-level APIs: only for URLs that map to a post.
		$post_id = url_to_postid( $url );
		if ( $post_id > 0 ) {
			if ( function_exists( 'wpfc_clear_post_cache_by_id' ) ) {
				wpfc_clear_post_cache_by_id( $post_id );
			}
			// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Hummingbird's documented purge hook.
			do_action( 'wphb_clear_page_cache', $post_id );
			if ( class_exists( 'WPO_Page_Cache' ) && method_exists( 'WPO_Page_Cache', 'delete_single_post_cache' ) ) {
				WPO_Page_Cache::delete_single_post_cache( $post_id );
			}
			if ( class_exists( 'WpeCommon' ) && method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
				WpeCommon::purge_varnish_cache( $post_id );
			}
			if ( isset( $GLOBALS['kinsta_cache'] ) && is_object( $GLOBALS['kinsta_cache'] ) && isset( $GLOBALS['kinsta_cache']->kinsta_cache_purge ) && method_exists( $GLOBALS['kinsta_cache']->kinsta_cache_purge, 'initiate_purge' ) ) {
				$GLOBALS['kinsta_cache']->kinsta_cache_purge->initiate_purge( $post_id );
			}
		}
	}

	/**
	 * Clear every other cache layer completely.
	 */
	public static function purge_all(): void {
		if ( self::$purging ) {
			return;
		}
		self::$purging = true;
		try {
			// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Calling other plugins' documented purge hooks.
			do_action( 'litespeed_purge_all' );
			do_action( 'cache_enabler_clear_complete_cache' );
			do_action( 'wphb_clear_page_cache' );
			do_action( 'breeze_clear_all_cache' );
			do_action( 'rt_nginx_helper_purge_all' );
			// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound
			if ( function_exists( 'rocket_clean_domain' ) ) {
				rocket_clean_domain();
			}
			if ( function_exists( 'w3tc_flush_all' ) ) {
				w3tc_flush_all();
			}
			if ( function_exists( 'wp_cache_clear_cache' ) ) {
				wp_cache_clear_cache();
			}
			if ( function_exists( 'wpfc_clear_all_cache' ) ) {
				wpfc_clear_all_cache( true );
			}
			if ( function_exists( 'sg_cachepress_purge_everything' ) ) {
				sg_cachepress_purge_everything();
			}
			if ( class_exists( '\FlyingPress\Purge' ) && method_exists( '\FlyingPress\Purge', 'purge_everything' ) ) {
				\FlyingPress\Purge::purge_everything();
			}
			if ( function_exists( 'spinupwp_purge_site' ) ) {
				spinupwp_purge_site();
			}
			if ( function_exists( 'pantheon_wp_clear_edge_all' ) ) {
				pantheon_wp_clear_edge_all();
			}
			if ( class_exists( 'WpeCommon' ) && method_exists( 'WpeCommon', 'purge_varnish_cache' ) ) {
				WpeCommon::purge_varnish_cache();
			}
			if ( isset( $GLOBALS['kinsta_cache'] ) && is_object( $GLOBALS['kinsta_cache'] ) && isset( $GLOBALS['kinsta_cache']->kinsta_cache_purge ) && method_exists( $GLOBALS['kinsta_cache']->kinsta_cache_purge, 'purge_complete_caches' ) ) {
				$GLOBALS['kinsta_cache']->kinsta_cache_purge->purge_complete_caches();
			}
			self::cloudflare_purge( array(), true );
		} finally {
			self::$purging = false;
		}
	}

	// Cloudflare (zone ID + API token with Cache Purge permission).

	/**
	 * Stored Cloudflare credentials.
	 */
	public static function cloudflare(): array {
		$stored = get_option( self::OPTION_CLOUDFLARE, array() );
		return array(
			'zone'  => is_array( $stored ) ? (string) ( $stored['zone'] ?? '' ) : '',
			'token' => is_array( $stored ) ? (string) ( $stored['token'] ?? '' ) : '',
			'error' => is_array( $stored ) ? (string) ( $stored['error'] ?? '' ) : '',
		);
	}

	/**
	 * Whether Cloudflare purging is configured.
	 */
	public static function cloudflare_ready(): bool {
		$cf = self::cloudflare();
		return '' !== $cf['zone'] && '' !== $cf['token'];
	}

	/**
	 * Save credentials after checking them against Cloudflare. Empty values remove them.
	 *
	 * @param string $zone  Zone ID.
	 * @param string $token API token.
	 * @return true|WP_Error
	 */
	public static function save_cloudflare( string $zone, string $token ) {
		$zone  = strtolower( trim( $zone ) );
		$token = trim( $token );
		if ( '' === $zone && '' === $token ) {
			delete_option( self::OPTION_CLOUDFLARE );
			return true;
		}
		if ( ! preg_match( '/^[a-f0-9]{32}$/', $zone ) ) {
			return new WP_Error( 'silo_cf_zone', __( 'The zone ID is the 32-character ID on the zone overview page in Cloudflare.', 'silo-connector' ) );
		}
		if ( '' === $token ) {
			$token = self::cloudflare()['token']; // Keep the saved token when only the zone changes.
		}
		$response = wp_remote_get(
			'https://api.cloudflare.com/client/v4/zones/' . rawurlencode( $zone ),
			array(
				'timeout' => 10,
				'headers' => array( 'Authorization' => 'Bearer ' . $token ),
			)
		);
		$body     = is_wp_error( $response ) ? array() : (array) json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( is_wp_error( $response ) || empty( $body['success'] ) ) {
			$message = is_wp_error( $response ) ? $response->get_error_message() : (string) ( $body['errors'][0]['message'] ?? __( 'Cloudflare rejected the token or zone.', 'silo-connector' ) );
			return new WP_Error( 'silo_cf_auth', $message );
		}
		update_option(
			self::OPTION_CLOUDFLARE,
			array(
				'zone'  => $zone,
				'token' => $token,
				'name'  => (string) ( $body['result']['name'] ?? '' ),
				'error' => '',
			),
			false
		);
		return true;
	}

	/**
	 * Purge URLs (30 per request, Cloudflare's limit on most plans) or the whole zone.
	 * Non-blocking: shoppers never wait on Cloudflare.
	 *
	 * @param string[] $urls URLs.
	 * @param bool     $all  Purge everything.
	 */
	private static function cloudflare_purge( array $urls, bool $all = false ): void {
		if ( ! self::cloudflare_ready() ) {
			return;
		}
		$cf      = self::cloudflare();
		$batches = $all ? array( null ) : array_chunk( array_values( array_unique( $urls ) ), 30 );
		foreach ( $batches as $batch ) {
			wp_remote_post(
				'https://api.cloudflare.com/client/v4/zones/' . rawurlencode( $cf['zone'] ) . '/purge_cache',
				array(
					'timeout'  => 3,
					'blocking' => false,
					'headers'  => array(
						'Authorization' => 'Bearer ' . $cf['token'],
						'Content-Type'  => 'application/json',
					),
					'body'     => (string) wp_json_encode( null === $batch ? array( 'purge_everything' => true ) : array( 'files' => $batch ) ),
				)
			);
		}
	}

	// Hook callbacks.

	/**
	 * Another cache was cleared by hand.
	 */
	public static function on_external_clear_all(): void {
		if ( self::$purging ) {
			return;
		}
		self::$purging = true;
		try {
			Silo_Page_Cache::purge_everything( false );
		} finally {
			self::$purging = false;
		}
	}

	/**
	 * A builder regenerated its CSS files: every cached page references the old ones.
	 */
	public static function on_builder_css_cleared(): void {
		Silo_Events::global_change( __( 'Page builder CSS regenerated', 'silo-connector' ), current_action() );
	}

	/**
	 * A builder saved a layout. Product layouts purge that product; anything else (header,
	 * footer, global template) can appear on every page.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function on_builder_layout_saved( $post_id ): void {
		$post_id = (int) $post_id;
		$type    = get_post_type( $post_id );
		if ( 'product' === $type ) {
			Silo_Events::on_builder_saved( $post_id );
		} elseif ( $type && in_array( $type, Silo_Events::layout_post_types(), true ) ) {
			Silo_Events::global_change( __( 'Template change', 'silo-connector' ), $type . ': ' . get_the_title( $post_id ) );
		}
	}
}
