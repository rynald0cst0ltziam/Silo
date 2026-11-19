<?php
/**
 * Silo advanced-cache.php drop-in.
 * Loaded before plugins when WP_CACHE is true.
 * Serves cached pages from disk — zero PHP overhead on cache hits.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// Hard bypass: never serve cached content for these.
if ( 'GET' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) ) {
	return;
}
if ( ! empty( $_POST ) ) { // phpcs:ignore
	return;
}

// Cart/checkout cookies = dynamic content.
$bypass_cookies = array(
	'woocommerce_items_in_cart',
	'woocommerce_cart_hash',
	'wp_woocommerce_session_',
	'wordpress_logged_in_',
	'wordpress_sec_',
	'comment_author_',
);

foreach ( $_COOKIE as $name => $value ) {
	foreach ( $bypass_cookies as $prefix ) {
		if ( str_starts_with( $name, $prefix ) ) {
			return;
		}
	}
}

// URI bypass.
$uri = $_SERVER['REQUEST_URI'] ?? '';
$bypass_uris = array(
	'/cart',
	'/checkout',
	'/my-account',
	'/wp-admin',
	'/wp-login.php',
	'/wp-cron.php',
	'/wp-json',
	'/xmlrpc.php',
	'/feed',
	'add-to-cart',
	'remove_item',
	'?wc-ajax=',
);

foreach ( $bypass_uris as $pattern ) {
	if ( str_contains( $uri, $pattern ) ) {
		return;
	}
}

// Query string bypass (search, preview, etc.).
if ( isset( $_GET['s'] ) || isset( $_GET['preview'] ) || isset( $_GET['add-to-cart'] ) ) { // phpcs:ignore
	return;
}

// Build cache key matching Silo_Page_Cache::maybe_write_cache().
$scheme   = ( ! empty( $_SERVER['HTTPS'] ) && 'off' !== $_SERVER['HTTPS'] ) ? 'https' : 'http';
$url      = $scheme . '://' . ( $_SERVER['HTTP_HOST'] ?? 'localhost' ) . $uri;
$ua       = $_SERVER['HTTP_USER_AGENT'] ?? '';
$device   = preg_match( '/Mobile|Android.*Mobile|iPhone|iPod/i', $ua ) ? 'mobile' : 'desktop';

// Currency detection.
$currency = 'default';
if ( isset( $_GET['currency'] ) ) { // phpcs:ignore
	$currency = $_GET['currency']; // phpcs:ignore
} elseif ( isset( $_COOKIE['wcml_client_currency'] ) ) {
	$currency = $_COOKIE['wcml_client_currency'];
} elseif ( isset( $_COOKIE['woocs_current_currency'] ) ) {
	$currency = $_COOKIE['woocs_current_currency'];
}

// Language detection (cookie-based only — constants not available yet).
$language = 'default';
if ( isset( $_COOKIE['wp-wpml_current_language'] ) ) {
	$language = $_COOKIE['wp-wpml_current_language'];
} elseif ( isset( $_COOKIE['pll_language'] ) ) {
	$language = $_COOKIE['pll_language'];
}

$cache_key = md5( $url . '|' . $device . '|' . $currency . '|' . $language );
$cache_dir = WP_CONTENT_DIR . '/cache/silo/';
$subdir    = $cache_dir . substr( $cache_key, 0, 2 ) . '/';
$html_file = $subdir . $cache_key . '.html';
$meta_file = $subdir . $cache_key . '.json';

if ( ! file_exists( $html_file ) || ! file_exists( $meta_file ) ) {
	return;
}

$meta = json_decode( file_get_contents( $meta_file ), true ); // phpcs:ignore
if ( ! $meta || ! isset( $meta['created'], $meta['ttl'] ) ) {
	return;
}

$age = time() - $meta['created'];
$ttl = $meta['ttl'];

// Expired: remove and let WordPress generate fresh.
if ( $age > $ttl * 2 ) {
	@unlink( $html_file ); // phpcs:ignore
	@unlink( $meta_file ); // phpcs:ignore
	silo_increment_stat( 'miss', $cache_dir );
	return;
}

// Stale but within grace period: serve stale, mark for revalidation.
if ( $age > $ttl ) {
	$html = file_get_contents( $html_file ); // phpcs:ignore
	if ( ! $html ) {
		return;
	}

	silo_increment_stat( 'hit', $cache_dir );

	header( 'X-Silo-Cache: STALE' );
	header( 'X-Silo-Key: ' . $cache_key );
	header( 'X-Silo-Age: ' . $age );
	header( 'Content-Type: ' . ( $meta['content_type'] ?? 'text/html; charset=UTF-8' ) );
	header( 'Content-Length: ' . strlen( $html ) );

	echo $html; // phpcs:ignore
	exit;
}

// Fresh cache hit.
$html = file_get_contents( $html_file ); // phpcs:ignore
if ( ! $html ) {
	return;
}

silo_increment_stat( 'hit', $cache_dir );

header( 'X-Silo-Cache: HIT' );
header( 'X-Silo-Key: ' . $cache_key );
header( 'X-Silo-Age: ' . $age );
header( 'Content-Type: ' . ( $meta['content_type'] ?? 'text/html; charset=UTF-8' ) );
header( 'Content-Length: ' . strlen( $html ) );

echo $html; // phpcs:ignore
exit;

/**
 * Increment stats file atomically.
 * Tracks both cumulative totals and delta counters for SaaS sync.
 */
function silo_increment_stat( string $type, string $cache_dir ): void {
	$stats_file = $cache_dir . '.stats.json';

	$stats = array(
		'total_hits'   => 0,
		'total_misses' => 0,
		'delta_hits'   => 0,
		'delta_misses' => 0,
		'last_reset'   => '',
	);

	if ( file_exists( $stats_file ) ) {
		$existing = json_decode( file_get_contents( $stats_file ), true ); // phpcs:ignore
		if ( is_array( $existing ) ) {
			$stats = array_merge( $stats, $existing );
		}
	}

	if ( 'hit' === $type ) {
		$stats['total_hits']++;
		$stats['delta_hits']++;
	} else {
		$stats['total_misses']++;
		$stats['delta_misses']++;
	}

	file_put_contents( $stats_file, json_encode( $stats ), LOCK_EX ); // phpcs:ignore
}
