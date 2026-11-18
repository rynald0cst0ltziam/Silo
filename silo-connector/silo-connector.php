<?php
/**
 * Plugin Name: Silo — WooCommerce Cache Connector
 * Plugin URI:  https://getsilo.io
 * Description: Connects your WooCommerce store to Silo for inventory-aware surgical cache invalidation.
 * Version:     1.0.0
 * Author:      Silo Systems, Inc.
 * Author URI:  https://getsilo.io
 * Requires PHP: 8.1
 * Requires at least: 6.4
 * WC requires at least: 8.2
 * License:     GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: silo-connector
 */

defined('ABSPATH') || exit;

define('SILO_VERSION', '1.0.0');
define('SILO_PLUGIN_FILE', __FILE__);
define('SILO_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SILO_PLUGIN_URL', plugin_dir_url(__FILE__));
define('SILO_CACHE_DIR', WP_CONTENT_DIR . '/cache/silo/');

require_once SILO_PLUGIN_DIR . 'includes/class-page-cache.php';
require_once SILO_PLUGIN_DIR . 'includes/class-event-reporter.php';
require_once SILO_PLUGIN_DIR . 'includes/class-config-applier.php';
require_once SILO_PLUGIN_DIR . 'includes/class-warmup.php';

final class Silo_Connector {

    private static ?self $instance = null;
    private Silo_Page_Cache $page_cache;
    private Silo_Event_Reporter $event_reporter;
    private Silo_Config_Applier $config_applier;
    private Silo_Warmup $warmup;

    public static function instance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->page_cache     = new Silo_Page_Cache();
        $this->event_reporter = new Silo_Event_Reporter();
        $this->config_applier = new Silo_Config_Applier();
        $this->warmup         = new Silo_Warmup();

        add_action('init', [$this, 'init']);
        add_action('rest_api_init', [$this, 'register_rest_routes']);
        add_action('admin_menu', [$this, 'admin_menu']);
        add_action('admin_init', [$this, 'admin_init']);

        register_activation_hook(__FILE__, [$this, 'activate']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate']);
    }

    public function init(): void {
        if (!$this->is_configured()) {
            return;
        }

        $this->event_reporter->register_hooks();
    }

    public function register_rest_routes(): void {
        $this->config_applier->register_routes();

        register_rest_route('silo/v1', '/connect', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_connect'],
            'permission_callback' => [$this, 'verify_hmac'],
        ]);

        register_rest_route('silo/v1', '/stats', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_stats'],
            'permission_callback' => [$this, 'verify_hmac'],
        ]);

        register_rest_route('silo/v1', '/purge', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_purge'],
            'permission_callback' => [$this, 'verify_hmac'],
        ]);

        register_rest_route('silo/v1', '/health', [
            'methods'             => 'GET',
            'callback'            => [$this, 'handle_health'],
            'permission_callback' => '__return_true',
        ]);
    }

    public function handle_connect(\WP_REST_Request $request): \WP_REST_Response {
        if (!class_exists('WooCommerce')) {
            return new \WP_REST_Response(['error' => 'WooCommerce not active'], 400);
        }

        $snapshot = $this->build_snapshot();

        return new \WP_REST_Response([
            'status'   => 'connected',
            'snapshot' => $snapshot,
        ], 200);
    }

    public function handle_stats(\WP_REST_Request $request): \WP_REST_Response {
        $stats = $this->page_cache->get_stats();
        return new \WP_REST_Response($stats, 200);
    }

    public function handle_purge(\WP_REST_Request $request): \WP_REST_Response {
        $urls = $request->get_param('urls');

        if ($urls && is_array($urls)) {
            $purged = $this->page_cache->purge_urls($urls);
        } else {
            $purged = $this->page_cache->purge_all();
        }

        return new \WP_REST_Response([
            'purged' => $purged,
        ], 200);
    }

    public function handle_health(\WP_REST_Request $request): \WP_REST_Response {
        $config = get_option('silo_config', []);

        return new \WP_REST_Response([
            'status'         => 'ok',
            'version'        => SILO_VERSION,
            'woo_active'     => class_exists('WooCommerce'),
            'cache_writable' => wp_is_writable(WP_CONTENT_DIR . '/cache/'),
            'config_version' => $config['version'] ?? 0,
            'php_version'    => PHP_VERSION,
            'wp_version'     => get_bloginfo('version'),
            'wc_version'     => defined('WC_VERSION') ? WC_VERSION : null,
        ], 200);
    }

    public function verify_hmac(\WP_REST_Request $request): bool {
        $api_key = get_option('silo_api_key', '');
        if (empty($api_key)) {
            return false;
        }

        $signature = $request->get_header('X-Silo-Signature');
        $timestamp = $request->get_header('X-Silo-Timestamp');

        if (!$signature || !$timestamp) {
            return false;
        }

        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $body    = $request->get_body();
        $payload = $timestamp . '.' . $body;
        $expected = hash_hmac('sha256', $payload, $api_key);

        return hash_equals($expected, $signature);
    }

    private function build_snapshot(): array {
        $product_counts = $this->get_product_type_counts();
        $bestsellers    = $this->get_bestseller_ids(10);

        return [
            'url'                   => home_url(),
            'product_count'         => array_sum($product_counts),
            'product_types'         => $product_counts,
            'variation_complexity'  => ($product_counts['variable'] ?? 0) > 100 ? 'high' : 'low',
            'stock_management'      => get_option('woocommerce_manage_stock') === 'yes',
            'hpos'                  => $this->is_hpos_enabled(),
            'multilingual'          => $this->detect_languages(),
            'multi_currency'        => $this->detect_multi_currency(),
            'bestsellers'           => $bestsellers,
            'existing_cache'        => $this->detect_existing_cache(),
        ];
    }

    private function get_product_type_counts(): array {
        global $wpdb;

        $results = $wpdb->get_results("
            SELECT tt.taxonomy, t.slug, COUNT(*) as count
            FROM {$wpdb->term_relationships} tr
            JOIN {$wpdb->term_taxonomy} tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
            JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
            WHERE tt.taxonomy = 'product_type'
            GROUP BY t.slug
        ");

        $counts = [];
        foreach ($results as $row) {
            $counts[$row->slug] = (int) $row->count;
        }

        return $counts;
    }

    private function get_bestseller_ids(int $limit = 10): array {
        global $wpdb;

        if ($this->is_hpos_enabled()) {
            $table = $wpdb->prefix . 'wc_order_product_lookup';
            if ($wpdb->get_var("SHOW TABLES LIKE '{$table}'") === $table) {
                $results = $wpdb->get_col($wpdb->prepare("
                    SELECT product_id
                    FROM {$table}
                    GROUP BY product_id
                    ORDER BY SUM(product_qty) DESC
                    LIMIT %d
                ", $limit));
                return array_map('intval', $results);
            }
        }

        $results = $wpdb->get_col($wpdb->prepare("
            SELECT meta.meta_value
            FROM {$wpdb->postmeta} meta
            JOIN {$wpdb->posts} p ON p.ID = meta.post_id
            WHERE meta.meta_key = '_product_id'
              AND p.post_type = 'shop_order'
              AND p.post_status IN ('wc-completed', 'wc-processing')
            GROUP BY meta.meta_value
            ORDER BY COUNT(*) DESC
            LIMIT %d
        ", $limit));

        return array_map('intval', $results);
    }

    private function is_hpos_enabled(): bool {
        if (class_exists('\Automattic\WooCommerce\Utilities\OrderUtil')) {
            return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
        }
        return false;
    }

    private function detect_languages(): array {
        if (defined('ICL_LANGUAGE_CODE')) {
            $languages = apply_filters('wpml_active_languages', null, ['skip_missing' => 0]);
            return is_array($languages) ? array_keys($languages) : [get_locale()];
        }

        if (function_exists('pll_languages_list')) {
            return pll_languages_list(['fields' => 'slug']);
        }

        return [substr(get_locale(), 0, 2)];
    }

    private function detect_multi_currency(): bool {
        if (class_exists('WCML_Multi_Currency')) return true;
        if (class_exists('WOOCS')) return true;
        if (defined('WCPBC_PLUGIN_FILE')) return true;
        return false;
    }

    private function detect_existing_cache(): ?string {
        if (defined('WP_ROCKET_VERSION')) return 'wp-rocket';
        if (defined('W3TC')) return 'w3-total-cache';
        if (defined('LSCWP_V')) return 'litespeed-cache';
        if (defined('WPFC_MAIN_PATH')) return 'wp-fastest-cache';
        if (class_exists('WPO_Page_Cache')) return 'wp-optimize';
        return null;
    }

    public function page_cache(): Silo_Page_Cache {
        return $this->page_cache;
    }

    public function warmup(): Silo_Warmup {
        return $this->warmup;
    }

    public function is_configured(): bool {
        return !empty(get_option('silo_api_key', ''));
    }

    public function get_api_key(): string {
        return get_option('silo_api_key', '');
    }

    public function get_saas_url(): string {
        return rtrim(get_option('silo_saas_url', 'https://app.getsilo.io'), '/');
    }

    public function admin_menu(): void {
        add_submenu_page(
            'woocommerce',
            'Silo Cache',
            'Silo Cache',
            'manage_woocommerce',
            'silo-connector',
            [$this, 'render_admin_page'],
        );
    }

    public function admin_init(): void {
        register_setting('silo_settings', 'silo_api_key', [
            'type'              => 'string',
            'sanitize_callback' => 'sanitize_text_field',
        ]);
        register_setting('silo_settings', 'silo_saas_url', [
            'type'              => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default'           => 'https://app.getsilo.io',
        ]);

        if (isset($_POST['silo_test_connection']) && check_admin_referer('silo_test_connection')) {
            $this->handle_test_connection();
        }

        if (isset($_POST['silo_purge_all']) && check_admin_referer('silo_purge_all')) {
            $purged = $this->page_cache->purge_all();
            add_settings_error('silo_settings', 'purge_ok', "Cache purged — {$purged} files removed.", 'success');
        }
    }

    private function handle_test_connection(): void {
        $api_key  = get_option('silo_api_key', '');
        $saas_url = rtrim(get_option('silo_saas_url', 'https://app.getsilo.io'), '/');

        if (empty($api_key)) {
            add_settings_error('silo_settings', 'no_key', 'Enter an API key first.', 'error');
            return;
        }

        $snapshot = $this->build_snapshot();
        $body     = wp_json_encode(['snapshot' => $snapshot]);
        $timestamp = (string) time();
        $payload   = $timestamp . '.' . $body;
        $signature = hash_hmac('sha256', $payload, $api_key);

        $response = wp_remote_post($saas_url . '/api/stores/connect', [
            'timeout' => 15,
            'headers' => [
                'Content-Type'     => 'application/json',
                'X-Silo-Signature' => $signature,
                'X-Silo-Timestamp' => $timestamp,
                'X-Silo-Store-Key' => $api_key,
            ],
            'body' => $body,
        ]);

        if (is_wp_error($response)) {
            add_settings_error('silo_settings', 'conn_fail',
                'Connection failed: ' . $response->get_error_message(), 'error');
            return;
        }

        $code = wp_remote_retrieve_response_code($response);
        $data = json_decode(wp_remote_retrieve_body($response), true);

        if ($code === 200 && ($data['status'] ?? '') === 'connected') {
            if (!empty($data['config'])) {
                update_option('silo_config', $data['config']);
            }
            update_option('silo_last_snapshot', $snapshot, false);
            update_option('silo_last_scan_at', current_time('mysql'), false);

            $product_count = $snapshot['product_count'] ?? 0;
            $types = $snapshot['product_types'] ?? [];
            $type_summary = [];
            foreach ($types as $t => $c) {
                $type_summary[] = "{$c} {$t}";
            }
            $config_ver = $data['config']['version'] ?? '?';
            $tier = ucfirst($data['config']['tier'] ?? 'unknown');
            $msg = "Connected — Scanned {$product_count} products (" . implode(', ', $type_summary) . "). ";
            $msg .= "Config v{$config_ver} applied, tier: {$tier}.";

            if (!empty($data['warning'])) {
                $msg .= " Warning: " . ($data['warning']['instructions'] ?? $data['warning']['plugin'] ?? '');
            }

            add_settings_error('silo_settings', 'connected', $msg, 'success');
        } else {
            $err = $data['error'] ?? "HTTP $code";
            add_settings_error('silo_settings', 'conn_fail',
                'Connection failed: ' . $err, 'error');
        }
    }

    public function render_admin_page(): void {
        $api_key    = get_option('silo_api_key', '');
        $saas_url   = get_option('silo_saas_url', 'https://app.getsilo.io');
        $config     = get_option('silo_config', []);
        $configured = $this->is_configured();
        $connected  = $configured && !empty($config['version']);
        $stats      = $configured ? $this->page_cache->get_stats() : null;
        $dropin_ok  = file_exists(WP_CONTENT_DIR . '/advanced-cache.php')
                      && str_contains(file_get_contents(WP_CONTENT_DIR . '/advanced-cache.php'), 'silo-connector');
        $wp_cache   = defined('WP_CACHE') && WP_CACHE;
        $cache_writable = wp_is_writable(SILO_CACHE_DIR);
        $woo_active = class_exists('WooCommerce');
        $snapshot   = get_option('silo_last_snapshot', []);
        $last_scan  = get_option('silo_last_scan_at', '');

        $hit_rate = 0;
        $total_requests = 0;
        if ($stats) {
            $total_requests = $stats['hits'] + $stats['misses'];
            $hit_rate = $total_requests > 0 ? round(($stats['hits'] / $total_requests) * 100, 1) : 0;
        }
        ?>
        <style>
            .silo-wrap { max-width: 960px; margin: 20px auto 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            .silo-header { display: flex; align-items: center; gap: 12px; margin-bottom: 24px; }
            .silo-header h1 { font-size: 24px; font-weight: 700; margin: 0; color: #1a1a2e; }
            .silo-header .silo-version { background: #e8e8f0; color: #555; font-size: 12px; padding: 2px 8px; border-radius: 10px; }
            .silo-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
            .silo-card { background: #fff; border: 1px solid #e2e4e9; border-radius: 8px; padding: 20px; }
            .silo-card-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #888; margin-bottom: 8px; }
            .silo-card-value { font-size: 28px; font-weight: 700; color: #1a1a2e; }
            .silo-card-sub { font-size: 12px; color: #888; margin-top: 4px; }
            .silo-section { background: #fff; border: 1px solid #e2e4e9; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
            .silo-section h2 { font-size: 16px; font-weight: 600; margin: 0 0 16px; color: #1a1a2e; }
            .silo-status-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .silo-status-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #fafafa; border-radius: 6px; font-size: 13px; }
            .silo-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
            .silo-dot-green { background: #22c55e; }
            .silo-dot-red { background: #ef4444; }
            .silo-dot-yellow { background: #f59e0b; }
            .silo-actions { display: flex; gap: 8px; margin-top: 16px; }
            .silo-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid #d1d5db; background: #fff; color: #374151; text-decoration: none; }
            .silo-btn:hover { background: #f9fafb; border-color: #9ca3af; }
            .silo-btn-primary { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
            .silo-btn-primary:hover { background: #2d2d4a; }
            .silo-btn-danger { color: #dc2626; border-color: #fecaca; }
            .silo-btn-danger:hover { background: #fef2f2; }
            .silo-input-group { margin-bottom: 16px; }
            .silo-input-group label { display: block; font-size: 13px; font-weight: 500; color: #374151; margin-bottom: 4px; }
            .silo-input-group input { width: 100%; max-width: 440px; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; }
            .silo-input-group input:focus { outline: none; border-color: #1a1a2e; box-shadow: 0 0 0 1px #1a1a2e; }
            .silo-input-group .silo-hint { font-size: 12px; color: #9ca3af; margin-top: 4px; }
            .silo-config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .silo-config-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
            .silo-config-item:last-child { border-bottom: 0; }
            .silo-config-key { color: #6b7280; }
            .silo-config-val { font-weight: 500; color: #1a1a2e; }
            .silo-bar-wrap { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 8px; }
            .silo-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
            .silo-notice { padding: 12px 16px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
            .silo-notice-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
            .silo-notice-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
            @media (max-width: 782px) {
                .silo-cards { grid-template-columns: 1fr 1fr; }
                .silo-status-grid { grid-template-columns: 1fr; }
                .silo-config-grid { grid-template-columns: 1fr; }
            }
        </style>

        <div class="silo-wrap">
            <?php settings_errors('silo_settings'); ?>

            <div class="silo-header">
                <h1>Silo</h1>
                <span class="silo-version">v<?php echo esc_html(SILO_VERSION); ?></span>
            </div>

            <?php if ($connected): ?>
            <!-- Stats Cards -->
            <div class="silo-cards">
                <div class="silo-card">
                    <div class="silo-card-label">Hit Rate</div>
                    <div class="silo-card-value"><?php echo $hit_rate; ?>%</div>
                    <div class="silo-bar-wrap">
                        <div class="silo-bar-fill" style="width:<?php echo $hit_rate; ?>%;background:<?php echo $hit_rate >= 80 ? '#22c55e' : ($hit_rate >= 50 ? '#f59e0b' : '#ef4444'); ?>"></div>
                    </div>
                </div>
                <div class="silo-card">
                    <div class="silo-card-label">Cache Hits</div>
                    <div class="silo-card-value"><?php echo number_format($stats['hits'] ?? 0); ?></div>
                    <div class="silo-card-sub">today</div>
                </div>
                <div class="silo-card">
                    <div class="silo-card-label">Cache Misses</div>
                    <div class="silo-card-value"><?php echo number_format($stats['misses'] ?? 0); ?></div>
                    <div class="silo-card-sub">today</div>
                </div>
                <div class="silo-card">
                    <div class="silo-card-label">Cached Pages</div>
                    <div class="silo-card-value"><?php echo number_format($stats['cached_pages'] ?? 0); ?></div>
                    <div class="silo-card-sub">on disk</div>
                </div>
            </div>
            <?php endif; ?>

            <!-- System Status -->
            <div class="silo-section">
                <h2>System Status</h2>
                <div class="silo-status-grid">
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo $connected ? 'silo-dot-green' : ($configured ? 'silo-dot-yellow' : 'silo-dot-red'); ?>"></span>
                        <span><?php echo $connected ? 'Connected to Silo' : ($configured ? 'API key set, not connected' : 'Not configured'); ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo $woo_active ? 'silo-dot-green' : 'silo-dot-red'; ?>"></span>
                        <span>WooCommerce <?php echo $woo_active ? (defined('WC_VERSION') ? WC_VERSION : 'active') : 'not active'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo $dropin_ok ? 'silo-dot-green' : 'silo-dot-red'; ?>"></span>
                        <span>advanced-cache.php <?php echo $dropin_ok ? 'installed' : 'missing'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo $wp_cache ? 'silo-dot-green' : 'silo-dot-red'; ?>"></span>
                        <span>WP_CACHE <?php echo $wp_cache ? 'enabled' : 'disabled'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo $cache_writable ? 'silo-dot-green' : 'silo-dot-red'; ?>"></span>
                        <span>Cache directory <?php echo $cache_writable ? 'writable' : 'not writable'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot silo-dot-green"></span>
                        <span>PHP <?php echo PHP_VERSION; ?></span>
                    </div>
                </div>

                <?php if ($configured): ?>
                <div class="silo-actions">
                    <form method="post" style="display:inline">
                        <?php wp_nonce_field('silo_test_connection'); ?>
                        <button type="submit" name="silo_test_connection" class="silo-btn silo-btn-primary">
                            <?php echo $connected ? 'Reconnect' : 'Connect to Silo'; ?>
                        </button>
                    </form>
                    <?php if ($connected): ?>
                    <form method="post" style="display:inline">
                        <?php wp_nonce_field('silo_purge_all'); ?>
                        <button type="submit" name="silo_purge_all" class="silo-btn silo-btn-danger">Purge All Cache</button>
                    </form>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>

            <?php if (!empty($snapshot) && is_array($snapshot)): ?>
            <!-- Store Scan Results -->
            <div class="silo-section">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                    <h2>Store Scan</h2>
                    <?php if ($last_scan): ?>
                    <span style="font-size:11px;color:#9ca3af">Last scan: <?php echo esc_html($last_scan); ?></span>
                    <?php endif; ?>
                </div>
                <div class="silo-cards" style="margin-bottom:16px">
                    <div class="silo-card">
                        <div class="silo-card-label">Total Products</div>
                        <div class="silo-card-value"><?php echo number_format($snapshot['product_count'] ?? 0); ?></div>
                    </div>
                    <?php if (!empty($snapshot['product_types']) && is_array($snapshot['product_types'])): ?>
                        <?php foreach ($snapshot['product_types'] as $type => $count): ?>
                        <div class="silo-card">
                            <div class="silo-card-label"><?php echo esc_html(ucfirst($type)); ?></div>
                            <div class="silo-card-value"><?php echo number_format($count); ?></div>
                        </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
                <div class="silo-status-grid">
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo ($snapshot['stock_management'] ?? false) ? 'silo-dot-green' : 'silo-dot-yellow'; ?>"></span>
                        <span>Stock management: <?php echo ($snapshot['stock_management'] ?? false) ? 'enabled' : 'disabled'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo ($snapshot['hpos'] ?? false) ? 'silo-dot-green' : 'silo-dot-yellow'; ?>"></span>
                        <span>HPOS: <?php echo ($snapshot['hpos'] ?? false) ? 'enabled' : 'legacy'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo ($snapshot['variation_complexity'] ?? 'low') === 'high' ? 'silo-dot-yellow' : 'silo-dot-green'; ?>"></span>
                        <span>Variation complexity: <?php echo esc_html($snapshot['variation_complexity'] ?? 'low'); ?></span>
                    </div>
                    <div class="silo-status-item">
                        <span class="silo-dot <?php echo ($snapshot['multi_currency'] ?? false) ? 'silo-dot-green' : 'silo-dot-yellow'; ?>"></span>
                        <span>Multi-currency: <?php echo ($snapshot['multi_currency'] ?? false) ? 'active' : 'single'; ?></span>
                    </div>
                    <div class="silo-status-item">
                        <?php $langs = $snapshot['multilingual'] ?? []; ?>
                        <span class="silo-dot <?php echo count($langs) > 1 ? 'silo-dot-green' : 'silo-dot-yellow'; ?>"></span>
                        <span>Languages: <?php echo count($langs) > 1 ? esc_html(implode(', ', $langs)) : 'single'; ?></span>
                    </div>
                    <?php if (!empty($snapshot['existing_cache'])): ?>
                    <div class="silo-status-item">
                        <span class="silo-dot silo-dot-red"></span>
                        <span>Conflict: <?php echo esc_html($snapshot['existing_cache']); ?> detected</span>
                    </div>
                    <?php endif; ?>
                </div>
            </div>
            <?php endif; ?>

            <?php if ($connected): ?>
            <!-- Active Config -->
            <div class="silo-section">
                <h2>Active Configuration</h2>
                <div class="silo-config-grid">
                    <div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Tier</span>
                            <span class="silo-config-val"><?php echo esc_html(ucfirst($config['tier'] ?? 'unknown')); ?></span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Config version</span>
                            <span class="silo-config-val"><?php echo esc_html($config['version'] ?? '—'); ?></span>
                        </div>
                        <?php if (!empty($config['ttl'])): ?>
                        <div class="silo-config-item">
                            <span class="silo-config-key">TTL (product)</span>
                            <span class="silo-config-val"><?php echo number_format(($config['ttl']['product'] ?? 3600) / 60); ?> min</span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">TTL (category)</span>
                            <span class="silo-config-val"><?php echo number_format(($config['ttl']['category'] ?? 1800) / 60); ?> min</span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">TTL (shop)</span>
                            <span class="silo-config-val"><?php echo number_format(($config['ttl']['shop'] ?? 1800) / 60); ?> min</span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">TTL (Store API)</span>
                            <span class="silo-config-val"><?php echo number_format(($config['ttl']['store_api'] ?? 300) / 60); ?> min</span>
                        </div>
                        <?php endif; ?>
                    </div>
                    <div>
                        <?php if (!empty($config['variants'])): ?>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Device variants</span>
                            <span class="silo-config-val"><?php echo !empty($config['variants']['device']) ? 'yes' : 'no'; ?></span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Currency variants</span>
                            <span class="silo-config-val"><?php echo !empty($config['variants']['currency']) ? 'yes' : 'no'; ?></span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Language variants</span>
                            <span class="silo-config-val"><?php echo !empty($config['variants']['language']) ? implode(', ', $config['variants']['language']) : 'default'; ?></span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Attribute filters</span>
                            <span class="silo-config-val"><?php echo !empty($config['variants']['attribute_filters']) ? 'yes' : 'no'; ?></span>
                        </div>
                        <?php endif; ?>
                        <?php if (!empty($config['exclusions'])): ?>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Exclusions</span>
                            <span class="silo-config-val"><?php echo esc_html(implode(', ', $config['exclusions'])); ?></span>
                        </div>
                        <?php endif; ?>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Warmup URLs/event</span>
                            <span class="silo-config-val"><?php echo esc_html($config['limits']['warmup_urls_per_event'] ?? 50); ?></span>
                        </div>
                        <div class="silo-config-item">
                            <span class="silo-config-key">Max monthly events</span>
                            <span class="silo-config-val"><?php echo number_format($config['limits']['max_monthly_events'] ?? 100000); ?></span>
                        </div>
                    </div>
                </div>
                <?php if (!empty($config['invalidation_rules'])): ?>
                <div style="margin-top:16px">
                    <div style="font-size:12px;font-weight:600;color:#888;margin-bottom:8px">Invalidation Rules</div>
                    <?php foreach ($config['invalidation_rules'] as $trigger => $targets): ?>
                    <div style="margin-bottom:6px">
                        <span style="font-size:12px;font-weight:500;color:#6366f1"><?php echo esc_html(str_replace('_', ' ', $trigger)); ?></span>
                        <span style="font-size:11px;color:#6b7280"> &mdash; <?php echo esc_html(implode(', ', $targets)); ?></span>
                    </div>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
                <?php if (!empty($config['store_api']['enabled'])): ?>
                <div style="margin-top:12px">
                    <div style="font-size:12px;font-weight:600;color:#888;margin-bottom:4px">Store API Caching</div>
                    <span style="font-size:11px;color:#6b7280">Endpoints: <?php echo esc_html(implode(', ', $config['store_api']['endpoints'] ?? [])); ?></span>
                    <?php if (!empty($config['store_api']['vary'])): ?>
                    <br><span style="font-size:11px;color:#6b7280">Vary: <?php echo esc_html(implode(', ', $config['store_api']['vary'])); ?></span>
                    <?php endif; ?>
                </div>
                <?php endif; ?>
            </div>
            <?php endif; ?>

            <!-- Settings -->
            <div class="silo-section">
                <h2>Settings</h2>
                <form method="post" action="options.php">
                    <?php settings_fields('silo_settings'); ?>
                    <div class="silo-input-group">
                        <label for="silo_api_key">API Key</label>
                        <input type="text" id="silo_api_key" name="silo_api_key"
                               value="<?php echo esc_attr($api_key); ?>" autocomplete="off" />
                        <div class="silo-hint">From your Silo dashboard &rarr; store settings.</div>
                    </div>
                    <div class="silo-input-group">
                        <label for="silo_saas_url">Silo URL</label>
                        <input type="url" id="silo_saas_url" name="silo_saas_url"
                               value="<?php echo esc_attr($saas_url); ?>" />
                        <div class="silo-hint">Default: https://app.getsilo.io — change only for self-hosted or staging.</div>
                    </div>
                    <button type="submit" class="silo-btn silo-btn-primary">Save Settings</button>
                </form>
            </div>
        </div>
        <?php
    }

    public function activate(): void {
        if (!is_dir(SILO_CACHE_DIR)) {
            wp_mkdir_p(SILO_CACHE_DIR);
        }

        $dropin_source = SILO_PLUGIN_DIR . 'advanced-cache.php';
        $dropin_dest   = WP_CONTENT_DIR . '/advanced-cache.php';

        if (file_exists($dropin_source) && !file_exists($dropin_dest)) {
            copy($dropin_source, $dropin_dest);
        }

        if (!defined('WP_CACHE') || !WP_CACHE) {
            $this->set_wp_cache_constant(true);
        }
    }

    public function deactivate(): void {
        $dropin = WP_CONTENT_DIR . '/advanced-cache.php';
        if (file_exists($dropin)) {
            $content = file_get_contents($dropin);
            if (str_contains($content, 'silo-connector')) {
                unlink($dropin);
            }
        }

        $this->set_wp_cache_constant(false);
    }

    private function set_wp_cache_constant(bool $enable): void {
        $config_file = ABSPATH . 'wp-config.php';
        if (!is_writable($config_file)) {
            return;
        }

        $content = file_get_contents($config_file);

        $content = preg_replace(
            "/define\s*\(\s*['\"]WP_CACHE['\"]\s*,\s*(true|false)\s*\)\s*;/",
            '',
            $content
        );

        if ($enable) {
            $content = preg_replace(
                "/(\/\*\*.*?That's all.*?\*\/|<\?php)/s",
                "$1\ndefine('WP_CACHE', true);",
                $content,
                1
            );
        }

        file_put_contents($config_file, $content);
    }
}

function silo(): Silo_Connector {
    return Silo_Connector::instance();
}

silo();
