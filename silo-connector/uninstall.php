<?php
/**
 * Uninstall: remove every trace of Silo from the site.
 *
 * Options, transients, tables, scheduled actions, the cache directory, the drop-in and
 * the WP_CACHE line are all removed. Anything Silo did not create is left alone: a
 * drop-in owned by another plugin is kept, and WP_CACHE is only removed if Silo added it.
 *
 * @package silo-connector
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.DirectDatabaseQuery.SchemaChange, WordPress.WP.AlternativeFunctions, WordPress.PHP.NoSilencedErrors

/**
 * Remove Silo from the current site.
 */
function silo_uninstall_site(): void {
	global $wpdb;

	$added_wp_cache = (bool) get_option( 'silo_added_wp_cache' );

	// Scheduled work.
	wp_clear_scheduled_hook( 'silo_heartbeat' );
	foreach ( array( 'silo_dispatch_events', 'silo_warmup_run', 'silo_scan_run', 'silo_sale_boundary' ) as $hook ) {
		wp_clear_scheduled_hook( $hook );
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			as_unschedule_all_actions( $hook, array(), 'silo' );
		}
	}

	// Options and transients.
	$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE 'silo\\_%' OR option_name LIKE '\\_transient\\_silo\\_%' OR option_name LIKE '\\_transient\\_timeout\\_silo\\_%'" );

	// Tables.
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}silo_events" );
	$wpdb->query( "DROP TABLE IF EXISTS {$wpdb->prefix}silo_warmup" );

	silo_uninstall_wp_cache_flag( $added_wp_cache );
}

/**
 * Carry the WP_CACHE ownership flag out of the per-site loop.
 *
 * @param bool|null $set Flag to record, or null to read.
 */
function silo_uninstall_wp_cache_flag( $set = null ): bool {
	static $flag = false;
	if ( null !== $set ) {
		$flag = $flag || $set;
	}
	return $flag;
}

/**
 * Recursively delete a directory inside wp-content/cache/silo.
 *
 * @param string $dir Dir.
 */
function silo_uninstall_rmdir( string $dir ): void {
	if ( ! is_dir( $dir ) ) {
		return;
	}
	$items = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS ),
		RecursiveIteratorIterator::CHILD_FIRST
	);
	foreach ( $items as $item ) {
		if ( $item->isDir() ) {
			@rmdir( $item->getPathname() );
		} else {
			@unlink( $item->getPathname() );
		}
	}
	@rmdir( $dir );
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $silo_site_id ) {
		switch_to_blog( $silo_site_id );
		silo_uninstall_site();
		restore_current_blog();
	}
} else {
	silo_uninstall_site();
}

// Cache files for every host.
silo_uninstall_rmdir( rtrim( WP_CONTENT_DIR, '/\\' ) . '/cache/silo' );

// The drop-in, only if it is ours.
$silo_dropin = WP_CONTENT_DIR . '/advanced-cache.php';
if ( is_file( $silo_dropin ) && str_contains( (string) file_get_contents( $silo_dropin ), 'silo-connector-dropin' ) ) {
	@unlink( $silo_dropin );
}

// WP_CACHE, only if Silo added it.
if ( silo_uninstall_wp_cache_flag() ) {
	$silo_config = is_file( ABSPATH . 'wp-config.php' ) ? ABSPATH . 'wp-config.php' : dirname( ABSPATH ) . '/wp-config.php';
	if ( is_file( $silo_config ) && is_writable( $silo_config ) ) {
		$silo_contents = (string) file_get_contents( $silo_config );
		$silo_updated  = (string) preg_replace( '/^.*\/\/ Added by Silo for WooCommerce.*\R?/m', '', $silo_contents );
		if ( $silo_updated !== $silo_contents ) {
			file_put_contents( $silo_config, $silo_updated );
		}
	}
}
