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
            add_settings_error('silo_settings', 'connected',
                'Connected to Silo! Config version: ' . ($data['config']['version'] ?? 'unknown'), 'success');
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
        $stats      = $configured ? $this->page_cache->get_stats() : null;
        ?>
        <div class="wrap">
            <h1>Silo Cache Connector</h1>
            <?php settings_errors('silo_settings'); ?>

            <form method="post" action="options.php">
                <?php settings_fields('silo_settings'); ?>

                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="silo_api_key">API Key</label></th>
                        <td>
                            <input type="text" id="silo_api_key" name="silo_api_key"
                                   value="<?php echo esc_attr($api_key); ?>"
                                   class="regular-text" autocomplete="off" />
                            <p class="description">Paste the API key from your Silo dashboard.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="silo_saas_url">Silo URL</label></th>
                        <td>
                            <input type="url" id="silo_saas_url" name="silo_saas_url"
                                   value="<?php echo esc_attr($saas_url); ?>"
                                   class="regular-text" />
                            <p class="description">Leave default unless self-hosting.</p>
                        </td>
                    </tr>
                </table>

                <?php submit_button('Save Settings'); ?>
            </form>

            <?php if ($configured): ?>
                <hr />
                <h2>Connection</h2>
                <form method="post">
                    <?php wp_nonce_field('silo_test_connection'); ?>
                    <p>Send your store snapshot to Silo and receive your optimized cache config.</p>
                    <?php submit_button('Connect to Silo', 'primary', 'silo_test_connection', false); ?>
                </form>

                <hr />
                <h2>Status</h2>
                <table class="widefat striped" style="max-width:500px">
                    <tr><td>Config version</td><td><?php echo esc_html($config['version'] ?? 'None'); ?></td></tr>
                    <tr><td>Tier</td><td><?php echo esc_html($config['tier'] ?? 'Unknown'); ?></td></tr>
                    <tr><td>Cache directory</td><td><?php echo wp_is_writable(SILO_CACHE_DIR) ? '✓ Writable' : '✗ Not writable'; ?></td></tr>
                    <?php if ($stats): ?>
                        <tr><td>Cache hits</td><td><?php echo number_format($stats['hits']); ?></td></tr>
                        <tr><td>Cache misses</td><td><?php echo number_format($stats['misses']); ?></td></tr>
                        <tr><td>Hit rate</td><td><?php echo $stats['hit_rate']; ?>%</td></tr>
                        <tr><td>Cached pages</td><td><?php echo number_format($stats['cached_pages']); ?></td></tr>
                    <?php endif; ?>
                </table>
            <?php endif; ?>
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
