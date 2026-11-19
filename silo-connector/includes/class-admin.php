<?php
/**
 * Admin: dashboard rendering, AJAX handlers, menu registration.
 * Dark theme matching getsilo.io design.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Admin {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );

		// AJAX handlers.
		add_action( 'wp_ajax_silo_get_stats', array( $this, 'ajax_get_stats' ) );
		add_action( 'wp_ajax_silo_run_scan', array( $this, 'ajax_run_scan' ) );
		add_action( 'wp_ajax_silo_scan_progress', array( $this, 'ajax_scan_progress' ) );
		add_action( 'wp_ajax_silo_test_connection', array( $this, 'ajax_test_connection' ) );
		add_action( 'wp_ajax_silo_purge_all', array( $this, 'ajax_purge_all' ) );
		add_action( 'wp_ajax_silo_save_settings', array( $this, 'ajax_save_settings' ) );
		add_action( 'wp_ajax_silo_connect', array( $this, 'ajax_connect' ) );
		add_action( 'wp_ajax_silo_disconnect', array( $this, 'ajax_disconnect' ) );
	}

	public function register_menu(): void {
		add_menu_page(
			__( 'Silo Cache', 'silo-connector' ),
			__( 'Silo', 'silo-connector' ),
			'manage_woocommerce',
			'silo',
			array( $this, 'render_dashboard' ),
			'data:image/svg+xml;base64,' . base64_encode( $this->get_menu_icon() ), // phpcs:ignore
			58
		);

		add_submenu_page(
			'silo',
			__( 'Overview', 'silo-connector' ),
			__( 'Overview', 'silo-connector' ),
			'manage_woocommerce',
			'silo',
			array( $this, 'render_dashboard' )
		);

		add_submenu_page(
			'silo',
			__( 'Settings', 'silo-connector' ),
			__( 'Settings', 'silo-connector' ),
			'manage_woocommerce',
			'silo-settings',
			array( $this, 'render_dashboard' )
		);
	}

	public function enqueue_assets( string $hook ): void {
		if ( ! str_contains( $hook, 'silo' ) ) {
			return;
		}

		wp_enqueue_style(
			'silo-admin',
			SILO_PLUGIN_URL . 'assets/css/admin.css',
			array(),
			SILO_VERSION
		);

		wp_enqueue_script(
			'silo-admin',
			SILO_PLUGIN_URL . 'assets/js/admin.js',
			array( 'jquery' ),
			SILO_VERSION,
			true
		);

		wp_localize_script( 'silo-admin', 'siloAdmin', array(
			'ajaxUrl'     => admin_url( 'admin-ajax.php' ),
			'nonce'       => wp_create_nonce( 'silo_admin_nonce' ),
			'isConnected' => silo()->is_configured(),
			'version'     => SILO_VERSION,
		) );
	}

	public function render_dashboard(): void {
		$tab = sanitize_text_field( wp_unslash( $_GET['tab'] ?? 'overview' ) ); // phpcs:ignore
		if ( isset( $_GET['page'] ) && 'silo-settings' === $_GET['page'] ) { // phpcs:ignore
			$tab = 'settings';
		}

		$is_connected = silo()->is_configured();
		?>
		<div class="silo-wrap">
			<div class="silo-header">
				<div class="silo-logo">
					<svg width="28" height="28" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect width="100" height="100" rx="20" fill="#4f46e5"/>
						<path d="M30 70V40l20-15 20 15v30" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M50 55v15" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
					</svg>
					<span class="silo-title">Silo</span>
					<span class="silo-version">v<?php echo esc_html( SILO_VERSION ); ?></span>
				</div>
				<?php if ( $is_connected ) : ?>
				<div class="silo-status-pill silo-status-connected">
					<span class="silo-pulse"></span>
					Connected
				</div>
				<?php else : ?>
				<div class="silo-status-pill silo-status-disconnected">
					Disconnected
				</div>
				<?php endif; ?>
			</div>

			<?php if ( ! $is_connected ) : ?>
				<?php $this->render_connect_screen(); ?>
			<?php else : ?>
				<div class="silo-tabs">
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=silo&tab=overview' ) ); ?>"
					   class="silo-tab <?php echo 'overview' === $tab ? 'active' : ''; ?>">Overview</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=silo&tab=invalidations' ) ); ?>"
					   class="silo-tab <?php echo 'invalidations' === $tab ? 'active' : ''; ?>">Invalidations</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=silo&tab=warmup' ) ); ?>"
					   class="silo-tab <?php echo 'warmup' === $tab ? 'active' : ''; ?>">Warmup</a>
					<a href="<?php echo esc_url( admin_url( 'admin.php?page=silo-settings' ) ); ?>"
					   class="silo-tab <?php echo 'settings' === $tab ? 'active' : ''; ?>">Settings</a>
				</div>

				<div class="silo-content" id="silo-content">
					<?php
					switch ( $tab ) {
						case 'invalidations':
							$this->render_invalidations_tab();
							break;
						case 'warmup':
							$this->render_warmup_tab();
							break;
						case 'settings':
							$this->render_settings_tab();
							break;
						default:
							$this->render_overview_tab();
					}
					?>
				</div>
			<?php endif; ?>

			<div id="silo-toast" class="silo-toast" style="display:none;"></div>
		</div>
		<?php
	}

	private function render_connect_screen(): void {
		?>
		<div class="silo-connect-screen">
			<div class="silo-connect-card">
				<div class="silo-connect-icon">
					<svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
						<rect width="100" height="100" rx="20" fill="#4f46e5"/>
						<path d="M30 70V40l20-15 20 15v30" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
						<path d="M50 55v15" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
					</svg>
				</div>
				<h2>Connect to Silo</h2>
				<p>Enter your API key from your Silo dashboard to connect this store.</p>
				<div class="silo-connect-form">
					<div class="silo-field">
						<label for="silo-api-key">API Key</label>
						<input type="password" id="silo-api-key" placeholder="sk_live_..." autocomplete="off" />
					</div>
					<button id="silo-connect-btn" class="silo-btn silo-btn-primary">
						<span class="silo-btn-text">Connect &amp; Scan</span>
						<span class="silo-btn-spinner" style="display:none;"></span>
					</button>
				</div>
				<div id="silo-scan-progress" class="silo-scan-progress" style="display:none;">
					<div class="silo-scan-bar">
						<div class="silo-scan-fill" id="silo-scan-fill"></div>
					</div>
					<div class="silo-scan-message" id="silo-scan-message">Initializing...</div>
				</div>
			</div>
		</div>
		<?php
	}

	private function render_overview_tab(): void {
		$stats = silo()->page_cache()->get_stats();
		$config = get_option( 'silo_config', array() );
		$tier   = $config['tier'] ?? 'solo';

		$dropin = WP_CONTENT_DIR . '/advanced-cache.php';
		$dropin_ok = file_exists( $dropin ) && str_contains( file_get_contents( $dropin ), 'silo-connector' ); // phpcs:ignore
		?>
		<div class="silo-kpi-grid" id="silo-kpi-grid">
			<div class="silo-kpi-card">
				<div class="silo-kpi-label">Hit Rate</div>
				<div class="silo-kpi-value" id="silo-hit-rate"><?php echo esc_html( $stats['hit_rate'] ); ?>%</div>
				<div class="silo-kpi-sub"><?php echo esc_html( number_format_i18n( $stats['hits'] ) ); ?> hits / <?php echo esc_html( number_format_i18n( $stats['misses'] ) ); ?> misses</div>
			</div>
			<div class="silo-kpi-card">
				<div class="silo-kpi-label">Cached Pages</div>
				<div class="silo-kpi-value" id="silo-cached-pages"><?php echo esc_html( number_format_i18n( $stats['cached_pages'] ) ); ?></div>
				<div class="silo-kpi-sub">Active in cache</div>
			</div>
			<div class="silo-kpi-card">
				<div class="silo-kpi-label">Tier</div>
				<div class="silo-kpi-value"><?php echo esc_html( ucfirst( $tier ) ); ?></div>
				<div class="silo-kpi-sub"><?php echo esc_html( $config['limits']['events_per_month'] ?? 'N/A' ); ?> events/mo</div>
			</div>
			<div class="silo-kpi-card">
				<div class="silo-kpi-label">Total Hits</div>
				<div class="silo-kpi-value" id="silo-total-hits"><?php echo esc_html( number_format_i18n( $stats['hits'] ) ); ?></div>
				<div class="silo-kpi-sub">Since <?php echo esc_html( $stats['last_reset'] ?: 'activation' ); ?></div>
			</div>
		</div>

		<div class="silo-section">
			<h3>System Status</h3>
			<div class="silo-status-grid">
				<div class="silo-status-item">
					<span class="silo-status-dot <?php echo $dropin_ok ? 'green' : 'red'; ?>"></span>
					Drop-in installed
				</div>
				<div class="silo-status-item">
					<span class="silo-status-dot <?php echo ( defined( 'WP_CACHE' ) && WP_CACHE ) ? 'green' : 'red'; ?>"></span>
					WP_CACHE enabled
				</div>
				<div class="silo-status-item">
					<span class="silo-status-dot <?php echo is_writable( SILO_CACHE_DIR ) ? 'green' : 'red'; ?>"></span>
					Cache directory writable
				</div>
				<div class="silo-status-item">
					<span class="silo-status-dot <?php echo ( get_option( 'silo_events_enabled', '1' ) === '1' ) ? 'green' : 'yellow'; ?>"></span>
					Event reporting
				</div>
				<div class="silo-status-item">
					<span class="silo-status-dot <?php echo ( get_option( 'silo_warmup_enabled', '1' ) === '1' ) ? 'green' : 'yellow'; ?>"></span>
					Warmup engine
				</div>
			</div>
		</div>

		<div class="silo-section">
			<h3>Recent Activity</h3>
			<div class="silo-activity-log" id="silo-activity-log">
				<?php $this->render_activity_log( 20 ); ?>
			</div>
		</div>
		<?php
	}

	private function render_invalidations_tab(): void {
		?>
		<div class="silo-section">
			<h3>Invalidation Events</h3>
			<div class="silo-filter-bar">
				<select id="silo-event-filter" class="silo-select">
					<option value="">All events</option>
					<option value="product_updated">Product Updated</option>
					<option value="stock_changed">Stock Changed</option>
					<option value="order_status_changed">Order Status</option>
					<option value="category_changed">Category Changed</option>
					<option value="coupon_updated">Coupon Updated</option>
				</select>
			</div>
			<div class="silo-activity-log silo-activity-log-full" id="silo-invalidation-log">
				<?php $this->render_activity_log( 100 ); ?>
			</div>
		</div>
		<?php
	}

	private function render_warmup_tab(): void {
		?>
		<div class="silo-section">
			<h3>Warmup Engine</h3>
			<div class="silo-warmup-status">
				<div class="silo-warmup-info">
					<span class="silo-status-dot <?php echo ( get_option( 'silo_warmup_enabled', '1' ) === '1' ) ? 'green' : 'yellow'; ?>"></span>
					<?php echo ( get_option( 'silo_warmup_enabled', '1' ) === '1' ) ? 'Active' : 'Paused'; ?>
				</div>
			</div>
			<div class="silo-section">
				<h4>Recent Warmup Activity</h4>
				<div class="silo-activity-log" id="silo-warmup-log">
					<?php $this->render_warmup_log( 50 ); ?>
				</div>
			</div>
		</div>
		<?php
	}

	private function render_settings_tab(): void {
		$api_key      = silo()->get_api_key();
		$masked_key   = $api_key ? substr( $api_key, 0, 8 ) . str_repeat( '*', max( 0, strlen( $api_key ) - 12 ) ) . substr( $api_key, -4 ) : '';
		$cache_on     = get_option( 'silo_cache_enabled', '1' );
		$events_on    = get_option( 'silo_events_enabled', '1' );
		$warmup_on    = get_option( 'silo_warmup_enabled', '1' );
		?>
		<div class="silo-section">
			<h3>Connection</h3>
			<div class="silo-settings-row">
				<label>API Key</label>
				<div class="silo-settings-value">
					<code><?php echo esc_html( $masked_key ); ?></code>
					<button id="silo-test-connection-btn" class="silo-btn silo-btn-sm">Test Connection</button>
				</div>
			</div>
			<div class="silo-settings-row">
				<label>SaaS URL</label>
				<div class="silo-settings-value">
					<code><?php echo esc_html( silo()->get_saas_url() ); ?></code>
				</div>
			</div>
		</div>

		<div class="silo-section">
			<h3>Features</h3>
			<div class="silo-settings-row">
				<label>Page Cache</label>
				<label class="silo-toggle">
					<input type="checkbox" id="silo-cache-toggle" <?php checked( $cache_on, '1' ); ?> data-option="silo_cache_enabled" />
					<span class="silo-toggle-slider"></span>
				</label>
			</div>
			<div class="silo-settings-row">
				<label>Event Reporting</label>
				<label class="silo-toggle">
					<input type="checkbox" id="silo-events-toggle" <?php checked( $events_on, '1' ); ?> data-option="silo_events_enabled" />
					<span class="silo-toggle-slider"></span>
				</label>
			</div>
			<div class="silo-settings-row">
				<label>Warmup Engine</label>
				<label class="silo-toggle">
					<input type="checkbox" id="silo-warmup-toggle" <?php checked( $warmup_on, '1' ); ?> data-option="silo_warmup_enabled" />
					<span class="silo-toggle-slider"></span>
				</label>
			</div>
		</div>

		<div class="silo-section silo-danger-zone">
			<h3>Danger Zone</h3>
			<div class="silo-settings-row">
				<div>
					<strong>Purge All Cache</strong>
					<p class="silo-settings-desc">Remove all cached pages and Store API responses. Stats will be reset.</p>
				</div>
				<button id="silo-purge-all-btn" class="silo-btn silo-btn-danger">Purge All</button>
			</div>
			<div class="silo-settings-row">
				<div>
					<strong>Disconnect Store</strong>
					<p class="silo-settings-desc">Remove API key and stop syncing with Silo. Cache will remain.</p>
				</div>
				<button id="silo-disconnect-btn" class="silo-btn silo-btn-danger">Disconnect</button>
			</div>
		</div>
		<?php
	}

	private function render_activity_log( int $limit ): void {
		$log_file = SILO_CACHE_DIR . '.activity.log';
		if ( ! file_exists( $log_file ) ) {
			echo '<div class="silo-empty">No activity recorded yet.</div>';
			return;
		}

		$lines = file( $log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
		if ( ! $lines ) {
			echo '<div class="silo-empty">No activity recorded yet.</div>';
			return;
		}

		$lines = array_slice( array_reverse( $lines ), 0, $limit );

		echo '<table class="silo-table"><thead><tr><th>Time</th><th>Event</th><th>Detail</th></tr></thead><tbody>';
		foreach ( $lines as $line ) {
			$parts = explode( '|', $line, 3 );
			if ( count( $parts ) < 3 ) {
				continue;
			}
			printf(
				'<tr><td class="silo-mono">%s</td><td><span class="silo-badge">%s</span></td><td>%s</td></tr>',
				esc_html( $parts[0] ),
				esc_html( $parts[1] ),
				esc_html( $parts[2] )
			);
		}
		echo '</tbody></table>';
	}

	private function render_warmup_log( int $limit ): void {
		$log_file = SILO_CACHE_DIR . '.warmup.log';
		if ( ! file_exists( $log_file ) ) {
			echo '<div class="silo-empty">No warmup activity yet.</div>';
			return;
		}

		$lines = file( $log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
		if ( ! $lines ) {
			echo '<div class="silo-empty">No warmup activity yet.</div>';
			return;
		}

		$lines = array_slice( array_reverse( $lines ), 0, $limit );

		echo '<table class="silo-table"><thead><tr><th>Time</th><th>URL</th><th>Status</th></tr></thead><tbody>';
		foreach ( $lines as $line ) {
			$parts = explode( '|', $line, 3 );
			if ( count( $parts ) < 3 ) {
				continue;
			}
			$status_class = 'ok' === trim( $parts[2] ) ? 'silo-badge-ok' : 'silo-badge-fail';
			printf(
				'<tr><td class="silo-mono">%s</td><td class="silo-url-cell">%s</td><td><span class="silo-badge %s">%s</span></td></tr>',
				esc_html( $parts[0] ),
				esc_html( $parts[1] ),
				esc_html( $status_class ),
				esc_html( trim( $parts[2] ) )
			);
		}
		echo '</tbody></table>';
	}

	// -- AJAX handlers --------------------------------------------------

	public function ajax_get_stats(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$stats = silo()->page_cache()->get_stats();
		wp_send_json_success( $stats );
	}

	public function ajax_connect(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$api_key = sanitize_text_field( wp_unslash( $_POST['api_key'] ?? '' ) );
		if ( empty( $api_key ) ) {
			wp_send_json_error( 'API key required' );
		}

		update_option( 'silo_api_key', $api_key );

		// Run scan and send to SaaS.
		$snapshot = silo()->scanner()->run_scan();

		$body    = wp_json_encode( array( 'snapshot' => $snapshot ) );
		$headers = silo()->sign_request( $body );

		$response = wp_remote_post( silo()->get_saas_url() . '/api/stores/connect', array(
			'timeout' => 30,
			'headers' => $headers,
			'body'    => $body,
		) );

		if ( is_wp_error( $response ) ) {
			wp_send_json_error( 'Connection failed: ' . $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		$result = json_decode( wp_remote_retrieve_body( $response ), true );

		if ( 200 !== $status ) {
			wp_send_json_error( 'SaaS returned HTTP ' . $status );
		}

		if ( ! empty( $result['config'] ) ) {
			update_option( 'silo_config', $result['config'], false );
		}

		// Schedule heartbeat.
		if ( ! wp_next_scheduled( 'silo_heartbeat_cron' ) ) {
			wp_schedule_event( time(), 'silo_five_minutes', 'silo_heartbeat_cron' );
		}

		// Trigger initial warmup.
		wp_schedule_single_event( time() + 5, 'silo_initial_warmup' );

		wp_send_json_success( array(
			'message'  => 'Connected',
			'config'   => $result['config'] ?? null,
			'snapshot' => $snapshot,
		) );
	}

	public function ajax_run_scan(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$snapshot = silo()->scanner()->run_scan();
		wp_send_json_success( $snapshot );
	}

	public function ajax_scan_progress(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		$progress = silo()->scanner()->get_scan_progress();
		wp_send_json_success( $progress );
	}

	public function ajax_test_connection(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$body    = wp_json_encode( array( 'ping' => true ) );
		$headers = silo()->sign_request( $body );

		$response = wp_remote_post( silo()->get_saas_url() . '/api/stores/heartbeat', array(
			'timeout' => 10,
			'headers' => $headers,
			'body'    => $body,
		) );

		if ( is_wp_error( $response ) ) {
			wp_send_json_error( $response->get_error_message() );
		}

		$status = wp_remote_retrieve_response_code( $response );
		if ( 200 === $status || 201 === $status ) {
			wp_send_json_success( 'Connection OK — HTTP ' . $status );
		} else {
			wp_send_json_error( 'HTTP ' . $status );
		}
	}

	public function ajax_purge_all(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$count = silo()->page_cache()->purge_all();
		Silo_Store_API_Cache::instance()->purge_all();

		// Notify SaaS.
		$body    = wp_json_encode( array( 'type' => 'purge_all', 'purged' => $count ) );
		$headers = silo()->sign_request( $body );
		wp_remote_post( silo()->get_saas_url() . '/api/events', array(
			'timeout' => 10,
			'headers' => $headers,
			'body'    => $body,
		) );

		wp_send_json_success( array( 'purged' => $count ) );
	}

	public function ajax_save_settings(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		$option = sanitize_text_field( wp_unslash( $_POST['option'] ?? '' ) );
		$value  = sanitize_text_field( wp_unslash( $_POST['value'] ?? '' ) );

		$allowed = array( 'silo_cache_enabled', 'silo_events_enabled', 'silo_warmup_enabled' );
		if ( ! in_array( $option, $allowed, true ) ) {
			wp_send_json_error( 'Invalid option' );
		}

		update_option( $option, $value );
		wp_send_json_success( array( 'option' => $option, 'value' => $value ) );
	}

	public function ajax_disconnect(): void {
		check_ajax_referer( 'silo_admin_nonce', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( 'Unauthorized', 403 );
		}

		delete_option( 'silo_api_key' );
		delete_option( 'silo_config' );
		delete_option( 'silo_last_scan' );
		delete_option( 'silo_scan_progress' );

		foreach ( array( 'silo_heartbeat_cron', 'silo_initial_warmup' ) as $hook ) {
			wp_unschedule_hook( $hook );
		}

		wp_send_json_success( 'Disconnected' );
	}

	private function get_menu_icon(): string {
		return '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 14V8l4-3 4 3v6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 11v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
	}
}
