<?php
/**
 * Silo advanced-cache.php drop-in.
 * Loaded by WordPress before plugins when WP_CACHE is true.
 * Serves cached pages from disk, bypassing PHP/WordPress for cache hits.
 *
 * @package silo-connector
 */

defined('ABSPATH') || exit;

if (php_sapi_name() === 'cli') {
    return;
}

// Hard bypass: never cache these
if (
    !empty($_POST) ||
    !empty($_GET['add-to-cart']) ||
    !empty($_GET['removed_item']) ||
    isset($_GET['no_cache']) ||
    (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] !== 'GET')
) {
    return;
}

// Cookie-based bypass: logged in users with cart items
$bypass_cookies = ['woocommerce_items_in_cart', 'woocommerce_cart_hash', 'wp_woocommerce_session_'];
foreach ($_COOKIE as $name => $value) {
    foreach ($bypass_cookies as $pattern) {
        if (str_starts_with($name, $pattern) && !empty($value)) {
            return;
        }
    }
}

// Bypass for logged-in users
foreach ($_COOKIE as $name => $value) {
    if (str_starts_with($name, 'wordpress_logged_in_')) {
        return;
    }
}

// URI-based bypass
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = parse_url($uri, PHP_URL_PATH) ?? '/';
$bypassed_paths = ['/cart', '/checkout', '/my-account', '/wp-admin', '/wp-login.php', '/wp-cron.php'];
foreach ($bypassed_paths as $bp) {
    if (str_starts_with($path, $bp)) {
        return;
    }
}

// Build cache key (must match Silo_Page_Cache::maybe_write_cache)
$scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host     = $_SERVER['HTTP_HOST'] ?? 'localhost';
$url      = $scheme . '://' . $host . $uri;
$device   = silo_detect_device();
$currency = silo_detect_currency();
$language = silo_detect_language();
$cache_key = md5($url . '|' . $device . '|' . $currency . '|' . $language);

$cache_dir  = WP_CONTENT_DIR . '/cache/silo/';
$cache_file = $cache_dir . substr($cache_key, 0, 2) . '/' . $cache_key . '.html';
$meta_file  = $cache_dir . substr($cache_key, 0, 2) . '/' . $cache_key . '.json';

if (!file_exists($cache_file) || !file_exists($meta_file)) {
    // Cache miss — track it and set header for proof
    silo_increment_stat('misses');
    header('X-Silo-Cache: MISS');
    return;
}

$meta = json_decode(file_get_contents($meta_file), true);
if (!$meta) {
    return;
}

// TTL check
$age = time() - ($meta['created'] ?? 0);
$ttl = $meta['ttl'] ?? 3600;

if ($age > $ttl) {
    if ($age > $ttl * 2) {
        silo_increment_stat('misses');
        header('X-Silo-Cache: EXPIRED');
        return;
    }
    header('X-Silo-Cache: STALE');
} else {
    header('X-Silo-Cache: HIT');
}

silo_increment_stat('hits');

// Send headers
$status = $meta['status'] ?? 200;
http_response_code($status);
header('Content-Type: ' . ($meta['content_type'] ?? 'text/html; charset=UTF-8'));
header('X-Silo-Key: ' . $cache_key);
header('X-Silo-Age: ' . $age);

readfile($cache_file);
exit;

function silo_detect_device(): string {
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    if (preg_match('/Mobile|Android.*Mobile|iPhone|iPod/i', $ua)) {
        return 'mobile';
    }
    return 'desktop';
}

function silo_detect_currency(): string {
    if (isset($_GET['currency'])) {
        return preg_replace('/[^A-Z]/', '', strtoupper($_GET['currency']));
    }
    if (isset($_COOKIE['wcml_client_currency'])) {
        return preg_replace('/[^A-Z]/', '', strtoupper($_COOKIE['wcml_client_currency']));
    }
    if (isset($_COOKIE['woocs_current_currency'])) {
        return preg_replace('/[^A-Z]/', '', strtoupper($_COOKIE['woocs_current_currency']));
    }
    return 'default';
}

function silo_detect_language(): string {
    if (isset($_COOKIE['wp-wpml_current_language'])) {
        return preg_replace('/[^a-z_-]/i', '', $_COOKIE['wp-wpml_current_language']);
    }
    if (isset($_GET['lang'])) {
        return preg_replace('/[^a-z_-]/i', '', $_GET['lang']);
    }
    return 'default';
}

function silo_increment_stat(string $type): void {
    $stats_file = WP_CONTENT_DIR . '/cache/silo/.stats.json';
    $stats = [];

    if (file_exists($stats_file)) {
        $stats = json_decode(file_get_contents($stats_file), true) ?: [];
    }

    $today = date('Y-m-d');
    if (($stats['date'] ?? '') !== $today) {
        $stats = ['date' => $today, 'hits' => 0, 'misses' => 0];
    }

    $stats[$type] = ($stats[$type] ?? 0) + 1;
    file_put_contents($stats_file, json_encode($stats), LOCK_EX);
}
