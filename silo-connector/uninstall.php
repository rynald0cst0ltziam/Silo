<?php
/**
 * Uninstall handler — removes ALL Silo data from the site.
 *
 * @package silo-connector
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// 1. Remove all silo_* options.
global $wpdb;
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'silo\_%'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

// 2. Delete transients.
$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_silo\_%' OR option_name LIKE '_transient_timeout_silo\_%'" ); // phpcs:ignore

// 3. Remove cache directory.
$cache_dir = WP_CONTENT_DIR . '/cache/silo/';
if ( is_dir( $cache_dir ) ) {
	$iter = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $cache_dir, FilesystemIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ( $iter as $file ) {
		if ( $file->isDir() ) {
			rmdir( $file->getPathname() );
		} else {
			unlink( $file->getPathname() );
		}
	}
	rmdir( $cache_dir );
}

// 4. Remove advanced-cache.php drop-in if ours.
$dropin = WP_CONTENT_DIR . '/advanced-cache.php';
if ( file_exists( $dropin ) ) {
	$content = file_get_contents( $dropin ); // phpcs:ignore
	if ( str_contains( $content, 'silo-connector' ) ) {
		unlink( $dropin ); // phpcs:ignore
	}
}

// 5. Unset WP_CACHE constant.
$config_file = ABSPATH . 'wp-config.php';
if ( is_writable( $config_file ) ) {
	$content = file_get_contents( $config_file ); // phpcs:ignore
	$content = preg_replace(
		"/define\s*\(\s*['\"]WP_CACHE['\"]\s*,\s*(true|false)\s*\)\s*;\s*\n?/",
		'',
		$content
	);
	file_put_contents( $config_file, $content ); // phpcs:ignore
}

// 6. Clear scheduled cron events.
$hooks = array( 'silo_heartbeat_cron', 'silo_initial_warmup' );
foreach ( $hooks as $hook ) {
	wp_unschedule_hook( $hook );
}
