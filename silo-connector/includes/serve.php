<?php
/**
 * Front door: serves cached WooCommerce responses before WordPress renders anything.
 *
 * Included by wp-content/advanced-cache.php (drop-in mode), or by the plugin on
 * plugins_loaded when another plugin owns the drop-in (late mode).
 *
 * Decisions recorded in $GLOBALS['silo_request'] are picked up by the plugin
 * once WordPress knows what kind of page is being rendered.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/cache-key.php';

// phpcs:disable WordPress.Security.ValidatedSanitizedInput, WordPress.Security.EscapeOutput, WordPress.WP.AlternativeFunctions, WordPress.PHP.NoSilencedErrors

if ( ! function_exists( 'silo_serve_request' ) ) {

	/**
	 * Serve a cached page and exit, or return and let WordPress render.
	 *
	 * @param string $mode 'dropin' or 'late'.
	 */
	function silo_serve_request( string $mode ): void {
		if ( isset( $GLOBALS['silo_request'] ) ) {
			return;
		}
		$GLOBALS['silo_request'] = array( 'mode' => $mode );

		$method = (string) ( $_SERVER['REQUEST_METHOD'] ?? 'GET' );
		if ( ( 'GET' !== $method && 'HEAD' !== $method ) || PHP_SAPI === 'cli' ) {
			return;
		}

		$host = (string) ( $_SERVER['HTTP_HOST'] ?? '' );
		if ( '' === $host ) {
			return;
		}

		$site   = silo_site_dir( $host );
		$config = silo_load_site_config( $site );
		if ( ! $config || empty( $config['enabled'] ) ) {
			return;
		}
		$GLOBALS['silo_request']['config'] = $config;

		$uri  = (string) ( $_SERVER['REQUEST_URI'] ?? '/' );
		$path = (string) strtok( $uri, '?' );
		if ( '' === $path || silo_path_excluded( $path, $config ) ) {
			$GLOBALS['silo_request']['excluded'] = true;
			return;
		}

		// Warmup requests from the connector always regenerate instead of reading.
		$warm = (string) ( $_SERVER['HTTP_X_SILO_WARMUP'] ?? '' );
		if ( '' !== $warm && ! empty( $config['warm_hash'] ) && hash_equals( (string) $config['warm_hash'], hash( 'sha256', $warm ) ) ) {
			$GLOBALS['silo_request']['warmup'] = true;
			return;
		}

		$reason = silo_session_bypass_reason( $_COOKIE, $_SERVER );
		if ( '' !== $reason ) {
			$GLOBALS['silo_request']['bypass'] = $reason;
			return;
		}

		$location = silo_request_location( $config );
		if ( null === $location ) {
			$GLOBALS['silo_request']['uncacheable'] = true;
			return;
		}
		$GLOBALS['silo_request']['location'] = $location;

		$html_file = $location['file'] . '.html';
		$meta_file = $location['file'] . '.json';
		if ( ! is_file( $html_file ) || ! is_file( $meta_file ) ) {
			return;
		}

		$meta = json_decode( (string) @file_get_contents( $meta_file ), true );
		if ( ! is_array( $meta ) || empty( $meta['created'] ) ) {
			return;
		}

		$age   = time() - (int) $meta['created'];
		$ttl   = max( 60, (int) ( $meta['ttl'] ?? 3600 ) );
		$state = 'HIT';

		if ( $age > $ttl ) {
			if ( $age > $ttl * 2 ) {
				@unlink( $html_file );
				@unlink( $meta_file );
				@unlink( $location['file'] . '.rq' );
				return;
			}
			// Inside the grace window: serve the stale copy and re-render in the background.
			$state = 'STALE';
			silo_queue_refresh( $site, $location['file'], (string) ( $meta['url'] ?? '' ) );
		}

		$html = @file_get_contents( $html_file );
		if ( false === $html || '' === $html ) {
			return;
		}

		$elapsed = silo_elapsed_ms();
		$bump    = array(
			'hits'   => 1,
			'hit_ms' => $elapsed,
			'hit_n'  => 1,
		);
		if ( ! empty( $meta['type'] ) && preg_match( '/^[a-z]+$/', (string) $meta['type'] ) ) {
			$bump[ 'hit_' . $meta['type'] ] = 1;
		}
		if ( 'STALE' === $state ) {
			$bump['stale'] = 1;
		}
		silo_stats_bump( $site, $bump );

		if ( ! headers_sent() ) {
			header( 'Content-Type: ' . (string) ( $meta['content_type'] ?? 'text/html; charset=UTF-8' ) );
			header( 'X-Silo-Cache: ' . $state );
			header( 'X-Silo-Age: ' . $age );
			if ( ! empty( $meta['scope'] ) ) {
				header( 'X-Silo-Scope: ' . preg_replace( '/[^A-Za-z0-9_:,\- ]/', '', (string) $meta['scope'] ) );
			}
			if ( 'late' === $mode ) {
				header( 'X-Silo-Mode: late' );
			}
			header( 'Content-Length: ' . strlen( $html ) );
		}

		if ( 'HEAD' !== $method ) {
			echo $html;
		}
		exit;
	}
}
