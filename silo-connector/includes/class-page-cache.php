<?php
/**
 * Page cache: writing, serving stats, purging.
 * The actual serve-from-disk happens in advanced-cache.php (drop-in).
 * This class handles the write side + cache management.
 *
 * @package silo-connector
 */

defined('ABSPATH') || exit;

class Silo_Page_Cache {

    private bool $should_cache = false;
    private string $cache_dir;

    public function __construct() {
        $this->cache_dir = SILO_CACHE_DIR;

        // Defer hook registration to 'init' — calling silo() here causes
        // infinite recursion because the Silo_Connector instance isn't
        // assigned yet during its own constructor.
        add_action('init', [$this, 'register_cache_hooks'], 1);
    }

    public function register_cache_hooks(): void {
        if (silo()->is_configured()) {
            add_action('template_redirect', [$this, 'maybe_start_buffer'], -1);
            add_action('shutdown', [$this, 'maybe_write_cache'], 0);
        }
    }

    public function maybe_start_buffer(): void {
        if (!$this->is_cacheable()) {
            return;
        }

        $this->should_cache = true;
        ob_start();
    }

    public function maybe_write_cache(): void {
        if (!$this->should_cache) {
            return;
        }

        $html = ob_get_clean();
        if (empty($html) || strlen($html) < 100) {
            echo $html;
            return;
        }

        if (http_response_code() !== 200) {
            echo $html;
            return;
        }

        $url       = $this->get_current_url();
        $device    = $this->detect_device();
        $currency  = $this->detect_currency();
        $language  = $this->detect_current_language();
        $cache_key = md5($url . '|' . $device . '|' . $currency . '|' . $language);
        $subdir    = $this->cache_dir . substr($cache_key, 0, 2) . '/';

        if (!is_dir($subdir)) {
            wp_mkdir_p($subdir);
        }

        $cache_file = $subdir . $cache_key . '.html';
        $meta_file  = $subdir . $cache_key . '.json';

        $config = get_option('silo_config', []);
        $ttl    = $this->resolve_ttl($config);

        $meta = [
            'url'          => $url,
            'device'       => $device,
            'currency'     => $currency,
            'language'     => $language,
            'created'      => time(),
            'ttl'          => $ttl,
            'status'       => 200,
            'content_type' => 'text/html; charset=UTF-8',
        ];

        file_put_contents($cache_file, $html, LOCK_EX);
        file_put_contents($meta_file, json_encode($meta), LOCK_EX);

        echo $html;
    }

    private function is_cacheable(): bool {
        if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
            return false;
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
            return false;
        }

        if (!empty($_POST)) {
            return false;
        }

        if (is_user_logged_in()) {
            return false;
        }

        if (defined('DONOTCACHEPAGE') && DONOTCACHEPAGE) {
            return false;
        }

        if (function_exists('is_cart') && is_cart()) return false;
        if (function_exists('is_checkout') && is_checkout()) return false;
        if (function_exists('is_account_page') && is_account_page()) return false;

        // Check exclusions from config
        $config     = get_option('silo_config', []);
        $exclusions = $config['exclusions'] ?? [];
        $uri        = $_SERVER['REQUEST_URI'] ?? '';

        foreach ($exclusions as $pattern) {
            if (str_starts_with($pattern, 'query:')) {
                $param = substr($pattern, 6);
                if (isset($_GET[$param])) return false;
            } elseif ($pattern === 'logged_in_with_cart') {
                continue; // Already handled above
            } elseif (str_contains($uri, $pattern)) {
                return false;
            }
        }

        return true;
    }

    private function resolve_ttl(array $config): int {
        $ttl_config = $config['ttl'] ?? [];

        if (function_exists('is_product') && is_product()) {
            return $ttl_config['product'] ?? 3600;
        }
        if (function_exists('is_product_category') && is_product_category()) {
            return $ttl_config['category'] ?? 1800;
        }
        if (function_exists('is_shop') && is_shop()) {
            return $ttl_config['shop'] ?? 1800;
        }

        return $ttl_config['product'] ?? 3600;
    }

    private function get_current_url(): string {
        $scheme = is_ssl() ? 'https' : 'http';
        return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '/');
    }

    private function detect_device(): string {
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        if (preg_match('/Mobile|Android.*Mobile|iPhone|iPod/i', $ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    private function detect_currency(): string {
        if (isset($_GET['currency'])) {
            return sanitize_text_field($_GET['currency']);
        }
        if (isset($_COOKIE['wcml_client_currency'])) {
            return sanitize_text_field($_COOKIE['wcml_client_currency']);
        }
        if (isset($_COOKIE['woocs_current_currency'])) {
            return sanitize_text_field($_COOKIE['woocs_current_currency']);
        }
        if (function_exists('get_woocommerce_currency')) {
            return get_woocommerce_currency();
        }
        return 'default';
    }

    private function detect_current_language(): string {
        if (defined('ICL_LANGUAGE_CODE')) {
            return ICL_LANGUAGE_CODE;
        }
        if (function_exists('pll_current_language')) {
            return pll_current_language('slug') ?: 'en';
        }
        return substr(get_locale(), 0, 2);
    }

    public function purge_urls(array $urls): int {
        $config     = get_option('silo_config', []);
        $currencies = $this->get_purge_currencies($config);
        $languages  = $config['variants']['language'] ?? ['en'];
        $count      = 0;

        foreach ($urls as $url) {
            foreach (['desktop', 'mobile'] as $device) {
                foreach ($currencies as $currency) {
                    foreach ($languages as $language) {
                        $key    = md5($url . '|' . $device . '|' . $currency . '|' . $language);
                        $subdir = $this->cache_dir . substr($key, 0, 2) . '/';
                        $html   = $subdir . $key . '.html';
                        $meta   = $subdir . $key . '.json';

                        if (file_exists($html)) {
                            unlink($html);
                            $count++;
                        }
                        if (file_exists($meta)) {
                            unlink($meta);
                        }
                    }
                }
            }
        }
        return $count;
    }

    private function get_purge_currencies(array $config): array {
        if (empty($config['variants']['currency'])) {
            return ['default'];
        }
        if (function_exists('get_woocommerce_currency')) {
            $base = get_woocommerce_currency();
            if (class_exists('WCML_Multi_Currency')) {
                $currencies = apply_filters('wcml_currencies', [$base]);
                return is_array($currencies) ? array_values($currencies) : [$base];
            }
            return [$base];
        }
        return ['default'];
    }

    public function purge_all(): int {
        $count = 0;
        $iter  = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($this->cache_dir, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iter as $file) {
            if ($file->isFile() && !str_starts_with($file->getFilename(), '.stats')) {
                unlink($file->getPathname());
                $count++;
            }
        }

        return $count;
    }

    public function get_stats(): array {
        $stats_file = $this->cache_dir . '.stats.json';
        $stats = [];

        if (file_exists($stats_file)) {
            $stats = json_decode(file_get_contents($stats_file), true) ?: [];
        }

        $hits   = $stats['hits'] ?? 0;
        $misses = $stats['misses'] ?? 0;
        $total  = $hits + $misses;

        $cached_pages = 0;
        if (is_dir($this->cache_dir)) {
            $iter = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator($this->cache_dir, \FilesystemIterator::SKIP_DOTS)
            );
            foreach ($iter as $file) {
                if ($file->isFile() && $file->getExtension() === 'html') {
                    $cached_pages++;
                }
            }
        }

        return [
            'hits'         => $hits,
            'misses'       => $misses,
            'hit_rate'     => $total > 0 ? round(($hits / $total) * 100, 1) : 0,
            'cached_pages' => $cached_pages,
            'date'         => $stats['date'] ?? date('Y-m-d'),
        ];
    }
}
