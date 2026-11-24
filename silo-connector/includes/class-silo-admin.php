<?php
/**
 * WooCommerce → Silo: the connector's admin app (connect, live scan, overview,
 * catalog, invalidations, warmup, status, settings) and its AJAX endpoints.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin screens.
 */
class Silo_Admin {

	const SLUG = 'silo';

	const ACTIONS = array( 'live', 'connect', 'scan_step', 'scan_start', 'purge_all', 'warm_priority', 'save_settings', 'disconnect', 'checks', 'entries', 'events', 'event', 'export', 'save_cloudflare' );

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ), 60 );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_init', array( __CLASS__, 'activation_redirect' ) );
		add_action( 'admin_notices', array( __CLASS__, 'notice_connect' ) );
		add_filter( 'plugin_action_links_' . SILO_BASENAME, array( __CLASS__, 'action_links' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );

		foreach ( self::ACTIONS as $action ) {
			add_action( 'wp_ajax_silo_' . $action, array( __CLASS__, 'ajax_' . $action ) );
		}
	}

	/**
	 * Menu.
	 */
	public static function menu(): void {
		add_submenu_page(
			'woocommerce',
			__( 'Silo', 'silo-connector' ),
			__( 'Silo', 'silo-connector' ),
			'manage_woocommerce',
			self::SLUG,
			array( __CLASS__, 'render' )
		);
	}

	/**
	 * Whether screen.
	 */
	public static function is_screen(): bool {
		return isset( $_GET['page'] ) && self::SLUG === $_GET['page']; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	}

	/**
	 * Body class.
	 *
	 * @param string $classes Body classes.
	 */
	public static function body_class( $classes ): string {
		return self::is_screen() ? $classes . ' silo-screen' : $classes;
	}

	/**
	 * Assets.
	 *
	 * @param string $hook Admin page hook.
	 */
	public static function assets( $hook ): void {
		if ( 'woocommerce_page_' . self::SLUG !== $hook && ! self::is_screen() ) {
			return;
		}
		wp_enqueue_style( 'silo-admin', SILO_URL . 'assets/css/admin.css', array(), SILO_VERSION );
		wp_enqueue_script( 'silo-admin', SILO_URL . 'assets/js/admin.js', array(), SILO_VERSION, true );
		wp_localize_script(
			'silo-admin',
			'siloAdmin',
			array(
				'ajax'    => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'silo_admin' ),
				'state'   => self::live_state(),
				'version' => SILO_VERSION,
			)
		);
	}

	/**
	 * Render.
	 */
	public static function render(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to manage Silo.', 'silo-connector' ) );
		}
		echo '<div class="silo-root"><div id="silo-app" class="silo-app" aria-live="polite"><div class="silo-boot"><span class="silo-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>' . esc_html__( 'Loading Silo…', 'silo-connector' ) . '</span></div></div>';
		echo '<noscript><p class="silo-noscript">' . esc_html__( 'Silo needs JavaScript enabled to show live cache data.', 'silo-connector' ) . '</p></noscript></div>';
	}

	/**
	 * Activation redirect.
	 */
	public static function activation_redirect(): void {
		if ( ! get_transient( 'silo_activation_redirect' ) ) {
			return;
		}
		delete_transient( 'silo_activation_redirect' );
		if ( wp_doing_ajax() || is_network_admin() || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		wp_safe_redirect( admin_url( 'admin.php?page=' . self::SLUG ) );
		exit;
	}

	/**
	 * Notice connect.
	 */
	public static function notice_connect(): void {
		if ( Silo_Settings::is_connected() || self::is_screen() || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		$screen = get_current_screen();
		if ( ! $screen || ! in_array( $screen->id, array( 'plugins', 'dashboard', 'woocommerce_page_wc-settings' ), true ) ) {
			return;
		}
		printf(
			'<div class="notice notice-info"><p><strong>%1$s</strong> %2$s <a class="button button-primary" style="margin-left:8px" href="%3$s">%4$s</a></p></div>',
			esc_html__( 'Silo is installed.', 'silo-connector' ),
			esc_html__( 'Paste your store key to map the catalog and start caching.', 'silo-connector' ),
			esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ),
			esc_html__( 'Connect store', 'silo-connector' )
		);
	}

	/**
	 * Notice missing woocommerce.
	 */
	public static function notice_missing_woocommerce(): void {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Silo for WooCommerce requires WooCommerce to be installed and active.', 'silo-connector' ) . '</p></div>';
	}

	/**
	 * Action links.
	 *
	 * @param array $links Plugin action links.
	 */
	public static function action_links( $links ): array {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=' . self::SLUG ) ) . '">' . esc_html( Silo_Settings::is_connected() ? __( 'Dashboard', 'silo-connector' ) : __( 'Connect', 'silo-connector' ) ) . '</a>' );
		return $links;
	}

	/**
	 * Everything the admin app renders, refreshed every few seconds.
	 */
	public static function live_state(): array {
		$store     = Silo_Settings::store();
		$config    = Silo_Settings::remote_config();
		$saas      = Silo_Settings::saas_url();
		$key       = Silo_Settings::api_key();
		$connected = Silo_Settings::is_connected();

		return array(
			'connected'    => $connected,
			'site'         => array(
				'host' => Silo_Settings::site_host(),
				'home' => home_url( '/' ),
				'shop' => function_exists( 'wc_get_page_permalink' ) ? (string) wc_get_page_permalink( 'shop' ) : '',
				'name' => get_bloginfo( 'name' ),
			),
			'store'        => $store,
			'saas_url'     => $saas,
			'saas_default' => Silo_Settings::build_value( 'saas_url' ),
			'dashboard'    => ( '' !== $saas && ! empty( $store['id'] ) ) ? $saas . '/dashboard/stores/' . rawurlencode( (string) $store['id'] ) : '',
			'key_hint'     => '' !== $key ? substr( $key, 0, 8 ) . '•••' . substr( $key, -4 ) : '',
			'version'      => SILO_VERSION,
			'stats'        => $connected ? Silo_Stats::summary() : null,
			'inventory'    => $connected ? Silo_Page_Cache::inventory() : null,
			'events24'     => $connected ? Silo_Log::count_last_day() : null,
			'events'       => $connected ? Silo_Log::recent( 25 ) : array(),
			'queued'       => $connected ? Silo_Log::count_state( 'queued' ) : 0,
			'warmup'       => $connected ? Silo_Warmup::snapshot( 24 ) : null,
			'scan'         => Silo_Scanner::public_state(),
			'heartbeat'    => array(
				'ok'    => (int) get_option( 'silo_hb_ok', 0 ),
				'sent'  => (int) get_option( 'silo_hb_last', 0 ),
				'ms'    => (int) get_option( 'silo_hb_ms', 0 ),
				'error' => (string) get_option( 'silo_hb_error', '' ),
			),
			'env'          => Silo_Status::compact(),
			'settings'     => Silo_Settings::all(),
			'compat'       => Silo_Compat::summary() + array( 'owner' => Silo_Compat::owner() ),
			'cloudflare'   => array(
				'zone'      => Silo_Compat::cloudflare()['zone'],
				'has_token' => '' !== Silo_Compat::cloudflare()['token'],
				'name'      => (string) ( get_option( Silo_Compat::OPTION_CLOUDFLARE, array() )['name'] ?? '' ),
			),
			'config'       => array(
				'version'  => (int) ( $config['version'] ?? 0 ),
				'tier'     => (string) ( $config['tier'] ?? ( $store['tier'] ?? '' ) ),
				'ttl'      => (array) ( $config['ttl'] ?? array() ),
				'variants' => (array) ( $config['variants'] ?? array() ),
				'limits'   => (array) ( $config['limits'] ?? array() ),
			),
			'now'          => time(),
		);
	}

	/**
	 * Guard.
	 */
	private static function require_capability(): void {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'You do not have permission to manage Silo.', 'silo-connector' ) ), 403 );
		}
	}

	/**
	 * Fail.
	 *
	 * @param string $message Message.
	 * @param int    $status Status.
	 */
	private static function fail( string $message, int $status = 400 ): void {
		wp_send_json_error( array( 'message' => $message ), $status );
	}

	/**
	 * Poll endpoint. Also keeps the heartbeat and event dispatch moving while someone watches.
	 */
	public static function ajax_live(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		if ( Silo_Settings::is_connected() ) {
			Silo_Events::maybe_kick();
			Silo_Page_Cache::drain_refresh_queue();
			if ( time() - (int) get_option( 'silo_hb_last', 0 ) >= 20 ) {
				Silo_Heartbeat::send( true );
			}
		}
		wp_send_json_success( self::live_state() );
	}

	/**
	 * AJAX handler: connect.
	 */
	public static function ajax_connect(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$key  = isset( $_POST['key'] ) ? trim( sanitize_text_field( wp_unslash( $_POST['key'] ) ) ) : '';
		$saas = isset( $_POST['saas_url'] ) ? untrailingslashit( esc_url_raw( wp_unslash( $_POST['saas_url'] ) ) ) : '';
		if ( '' === $saas ) {
			$saas = Silo_Settings::saas_url();
		}

		if ( ! preg_match( '/^sk_[a-z]+_[A-Za-z0-9_\-]{16,}$/', $key ) ) {
			self::fail( __( 'That does not look like a Silo store key. It starts with sk_silo_ and is shown once when you add the store in Silo.', 'silo-connector' ) );
		}
		if ( '' === $saas || ! wp_http_validate_url( $saas ) ) {
			self::fail( __( 'Enter the Silo service URL (the address of your Silo dashboard).', 'silo-connector' ) );
		}

		$response = Silo_Api::post( '/api/stores/handshake', Silo_Status::handshake_payload(), 15, true, $key, $saas );
		if ( is_wp_error( $response ) ) {
			/* translators: %s: error message */
			self::fail( sprintf( __( 'Could not reach Silo: %s. Check that this server can make outbound HTTPS requests.', 'silo-connector' ), $response->get_error_message() ), 502 );
		}
		if ( 200 !== $response['code'] || empty( $response['body']['store']['id'] ) ) {
			self::fail( Silo_Api::error_message( $response ), 401 === $response['code'] ? 401 : 400 );
		}

		update_option( 'silo_api_key', $key, false );
		if ( Silo_Settings::build_value( 'saas_url' ) !== $saas ) {
			update_option( 'silo_saas_url', $saas, false );
		} else {
			delete_option( 'silo_saas_url' );
		}
		update_option( 'silo_store', (array) $response['body']['store'], false );
		delete_option( 'silo_auth_error' );
		delete_option( 'silo_hb_error' );

		Silo_Installer::install_dropin();
		Silo_Installer::enable_wp_cache();
		Silo_Stats::reset();
		Silo_Settings::write_edge_config();
		Silo_Heartbeat::schedule();
		Silo_Scanner::start( 'admin' );

		wp_send_json_success( self::live_state() );
	}

	/**
	 * AJAX handler: scan step.
	 */
	public static function ajax_scan_step(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		wp_send_json_success( Silo_Scanner::public_state( Silo_Scanner::step() ) );
	}

	/**
	 * AJAX handler: scan start.
	 */
	public static function ajax_scan_start(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		if ( ! Silo_Settings::is_connected() ) {
			self::fail( __( 'Connect the store first.', 'silo-connector' ) );
		}
		$state = Silo_Scanner::is_running() ? Silo_Scanner::state() : Silo_Scanner::start( 'admin' );
		wp_send_json_success( Silo_Scanner::public_state( $state ) );
	}

	/**
	 * AJAX handler: purge all.
	 */
	public static function ajax_purge_all(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$count = Silo_Page_Cache::purge_everything( true );
		Silo_Events::log_purge_all( 'admin', $count, Silo_Settings::is_connected() );
		wp_send_json_success(
			array(
				'purged' => $count,
				'state'  => self::live_state(),
			)
		);
	}

	/**
	 * AJAX handler: warm priority.
	 */
	public static function ajax_warm_priority(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$response = Silo_Api::post( '/api/warmup/request', array( 'reason' => 'manual' ), 15 );
		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			self::fail( Silo_Api::error_message( $response ), 502 );
		}
		$urls   = (array) ( $response['body']['urls'] ?? array() );
		$job    = (string) ( $response['body']['job_id'] ?? '' );
		$queued = $job ? Silo_Warmup::enqueue( $urls, $job, 'manual' ) : 0;
		wp_send_json_success(
			array(
				'queued' => $queued,
				'state'  => self::live_state(),
			)
		);
	}

	/**
	 * AJAX handler: save settings.
	 */
	public static function ajax_save_settings(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$raw      = isset( $_POST['settings'] ) ? json_decode( wp_unslash( $_POST['settings'] ), true ) : array(); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		$before   = Silo_Settings::all();
		$settings = Silo_Settings::update( is_array( $raw ) ? $raw : array() );

		if ( $before['page_cache'] && ! $settings['page_cache'] ) {
			Silo_Page_Cache::purge_everything( false );
		}
		if ( $before['store_api_cache'] && ! $settings['store_api_cache'] ) {
			Silo_Store_API_Cache::purge( 'all' );
		}
		if ( ! $before['warmup'] && $settings['warmup'] ) {
			Silo_Warmup::schedule();
		}
		wp_send_json_success( self::live_state() );
	}

	/**
	 * AJAX handler: save (or remove) Cloudflare credentials. The token is checked against
	 * Cloudflare before it is stored and is never sent back to the browser.
	 */
	public static function ajax_save_cloudflare(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$zone   = isset( $_POST['zone'] ) ? sanitize_text_field( wp_unslash( $_POST['zone'] ) ) : '';
		$token  = isset( $_POST['token'] ) ? sanitize_text_field( wp_unslash( $_POST['token'] ) ) : '';
		$result = Silo_Compat::save_cloudflare( $zone, $token );
		if ( is_wp_error( $result ) ) {
			self::fail( $result->get_error_message() );
		}
		wp_send_json_success( self::live_state() );
	}

	/**
	 * AJAX handler: disconnect.
	 */
	public static function ajax_disconnect(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		Silo_Settings::disconnect();
		wp_send_json_success( self::live_state() );
	}

	/**
	 * AJAX handler: checks.
	 */
	public static function ajax_checks(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		wp_send_json_success( Silo_Status::checks( true ) );
	}

	/**
	 * AJAX handler: entries.
	 */
	public static function ajax_entries(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		wp_send_json_success(
			array(
				'entries'   => Silo_Page_Cache::entries( 300 ),
				'inventory' => Silo_Page_Cache::inventory( true ),
			)
		);
	}

	/**
	 * AJAX handler: events.
	 */
	public static function ajax_events(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$group  = isset( $_POST['group'] ) ? sanitize_key( wp_unslash( $_POST['group'] ) ) : '';
		$before = isset( $_POST['before'] ) ? absint( $_POST['before'] ) : 0;
		wp_send_json_success( Silo_Log::recent( 40, $group, $before ) );
	}

	/**
	 * Data for CSV/JSON exports: events, warmup, cache, diagnostics.
	 */
	public static function ajax_export(): void {
		global $wpdb;
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$kind = isset( $_POST['kind'] ) ? sanitize_key( wp_unslash( $_POST['kind'] ) ) : '';

		switch ( $kind ) {
			case 'events':
				$rows = array();
				foreach ( Silo_Log::recent( 1000, '', 0, true ) as $event ) {
					$scope  = (array) ( $event['scope'] ?? array() );
					$rows[] = array(
						'time'          => $event['created_at'],
						'trigger'       => $event['type'],
						'object'        => $event['object'],
						'detail'        => $event['detail'],
						'state'         => $event['state'],
						'urls_purged'   => $event['purged'],
						'urls_warmed'   => $event['warm_total'],
						'local_ms'      => $event['local_ms'],
						'silo_ms'       => $event['duration_ms'],
						'silo_event_id' => $event['event_id'],
						'purged_urls'   => implode( ' ', array_unique( array_merge( (array) ( $scope['local'] ?? array() ), (array) ( $scope['resolved'] ?? array() ) ) ) ),
					);
				}
				wp_send_json_success( $rows );
				break;
			case 'warmup':
				$table = Silo_Warmup::table();
				$rows  = (array) $wpdb->get_results( "SELECT url, status, http_code, ms AS desktop_ms, mobile_ms, cache_state, error, attempts, job_id, created_at, updated_at FROM {$table} ORDER BY id DESC LIMIT 2000", ARRAY_A ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				wp_send_json_success( $rows );
				break;
			case 'cache':
				wp_send_json_success( Silo_Page_Cache::entries( 5000 ) );
				break;
			case 'diagnostics':
				wp_send_json_success(
					array(
						'generated_at'   => gmdate( 'c' ),
						'site'           => home_url( '/' ),
						'connector'      => SILO_VERSION,
						'wordpress'      => get_bloginfo( 'version' ),
						'woocommerce'    => defined( 'WC_VERSION' ) ? WC_VERSION : '',
						'php'            => PHP_VERSION,
						'checks'         => Silo_Status::checks( false ),
						'environment'    => Silo_Status::compact(),
						'settings'       => Silo_Settings::all(),
						'profile'        => Silo_Settings::remote_config(),
						'stats'          => Silo_Stats::summary(),
						'inventory'      => Silo_Page_Cache::inventory( true ),
						'warmup'         => Silo_Warmup::counts(),
						'last_scan'      => Silo_Scanner::public_state(),
						'active_plugins' => array_values( (array) get_option( 'active_plugins', array() ) ),
					)
				);
				break;
			default:
				self::fail( __( 'Unknown export.', 'silo-connector' ) );
		}
	}

	/**
	 * AJAX handler: event.
	 */
	public static function ajax_event(): void {
		check_ajax_referer( 'silo_admin', 'nonce' );
		self::require_capability();
		$event = Silo_Log::find( isset( $_POST['id'] ) ? absint( $_POST['id'] ) : 0 );
		if ( ! $event ) {
			self::fail( __( 'Event not found.', 'silo-connector' ), 404 );
		}
		wp_send_json_success( $event );
	}
}
