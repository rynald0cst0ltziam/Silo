<?php
/**
 * Activation, upgrade and deactivation: tables, drop-in, WP_CACHE, schedules.
 *
 * The connector only ever removes what it added: a foreign advanced-cache.php is
 * left untouched (late serve mode is used instead), and WP_CACHE is only unset
 * when Silo was the one that set it.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Install lifecycle.
 */
class Silo_Installer {

	const DROPIN_MARKER = 'silo-connector-dropin';
	const CONFIG_MARKER = '// Added by Silo for WooCommerce';

	/**
	 * Activate.
	 */
	public static function activate(): void {
		self::install();
		if ( ! isset( $_GET['activate-multi'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			set_transient( 'silo_activation_redirect', 1, 60 );
		}
	}

	/**
	 * Maybe upgrade.
	 */
	public static function maybe_upgrade(): void {
		if ( get_option( 'silo_version' ) !== SILO_VERSION ) {
			self::install();
		}
	}

	/**
	 * Install.
	 */
	public static function install(): void {
		self::create_tables();
		wp_mkdir_p( silo_cache_root() );
		self::protect_dir( silo_cache_root() );
		self::install_dropin();
		self::enable_wp_cache();
		Silo_Settings::warm_token();
		Silo_Settings::write_edge_config();
		Silo_Heartbeat::schedule();
		update_option( 'silo_version', SILO_VERSION, false );
	}

	/**
	 * Deactivate.
	 */
	public static function deactivate(): void {
		Silo_Page_Cache::purge_everything( false );
		self::remove_dropin();
		self::disable_wp_cache();
		Silo_Heartbeat::unschedule();
		self::unschedule_actions();

		$dir = Silo_Settings::site_dir();
		if ( is_file( $dir . 'config.json' ) ) {
			wp_delete_file( $dir . 'config.json' );
		}
		delete_option( 'silo_version' );
	}

	/**
	 * Unschedule actions.
	 */
	public static function unschedule_actions(): void {
		if ( function_exists( 'as_unschedule_all_actions' ) ) {
			foreach ( array( 'silo_dispatch_events', 'silo_warmup_run', 'silo_scan_run', 'silo_sale_boundary' ) as $hook ) {
				as_unschedule_all_actions( $hook, array(), 'silo' );
			}
		}
		foreach ( array( 'silo_dispatch_events', 'silo_warmup_run', 'silo_scan_run', 'silo_sale_boundary' ) as $hook ) {
			wp_clear_scheduled_hook( $hook );
		}
	}

	/**
	 * Create tables.
	 */
	public static function create_tables(): void {
		global $wpdb;
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';

		$charset = $wpdb->get_charset_collate();

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}silo_events (
id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
ref char(32) NOT NULL,
type varchar(48) NOT NULL,
object varchar(191) NOT NULL DEFAULT '',
detail varchar(191) NOT NULL DEFAULT '',
state varchar(16) NOT NULL DEFAULT 'queued',
purged int(10) unsigned NOT NULL DEFAULT 0,
warm_total int(10) unsigned NOT NULL DEFAULT 0,
duration_ms int(10) unsigned NOT NULL DEFAULT 0,
local_ms int(10) unsigned NOT NULL DEFAULT 0,
attempts tinyint(3) unsigned NOT NULL DEFAULT 0,
saas_event_id varchar(40) NOT NULL DEFAULT '',
warm_job_id varchar(40) NOT NULL DEFAULT '',
payload longtext NULL,
scope longtext NULL,
created_at datetime NOT NULL,
updated_at datetime NOT NULL,
PRIMARY KEY  (id),
KEY state (state),
KEY warm_job_id (warm_job_id),
KEY created_at (created_at)
) $charset;"
		);

		dbDelta(
			"CREATE TABLE {$wpdb->prefix}silo_warmup (
id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
job_id varchar(40) NOT NULL DEFAULT '',
url text NOT NULL,
url_hash char(32) NOT NULL,
priority smallint(5) unsigned NOT NULL DEFAULT 100,
status varchar(12) NOT NULL DEFAULT 'queued',
http_code smallint(5) unsigned NOT NULL DEFAULT 0,
ms int(10) unsigned NOT NULL DEFAULT 0,
mobile_ms int(10) unsigned NOT NULL DEFAULT 0,
cache_state varchar(12) NOT NULL DEFAULT '',
error varchar(191) NOT NULL DEFAULT '',
attempts tinyint(3) unsigned NOT NULL DEFAULT 0,
created_at datetime NOT NULL,
updated_at datetime NOT NULL,
PRIMARY KEY  (id),
KEY status (status),
KEY job_id (job_id),
KEY url_hash (url_hash)
) $charset;"
		);
	}

	/**
	 * Keep the cache directory from being listed or executed directly.
	 *
	 * @param string $dir Dir.
	 */
	public static function protect_dir( string $dir ): void {
		// phpcs:disable WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		if ( ! is_file( $dir . 'index.php' ) ) {
			file_put_contents( $dir . 'index.php', "<?php\n// Silence is golden.\n" );
		}
		if ( ! is_file( $dir . '.htaccess' ) ) {
			file_put_contents( $dir . '.htaccess', "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n" );
		}
		// phpcs:enable
	}

	/**
	 * Dropin path.
	 */
	public static function dropin_path(): string {
		return WP_CONTENT_DIR . '/advanced-cache.php';
	}

	/**
	 * State of wp-content/advanced-cache.php: ours | stale | foreign | missing.
	 */
	public static function dropin_status(): string {
		$path = self::dropin_path();
		if ( ! is_file( $path ) ) {
			return 'missing';
		}
		$contents = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		if ( ! str_contains( $contents, self::DROPIN_MARKER ) ) {
			return 'foreign';
		}
		return str_contains( $contents, var_export( SILO_DIR . 'includes/serve.php', true ) ) ? 'ours' : 'stale'; // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export
	}

	/**
	 * Name of the plugin that owns a foreign drop-in, when recognisable.
	 */
	public static function foreign_dropin_owner(): string {
		if ( 'foreign' !== self::dropin_status() ) {
			return '';
		}
		$contents = strtolower( (string) file_get_contents( self::dropin_path() ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$owners   = array(
			'wp rocket'        => 'WP Rocket',
			'wp-rocket'        => 'WP Rocket',
			'w3 total cache'   => 'W3 Total Cache',
			'w3tc'             => 'W3 Total Cache',
			'wp super cache'   => 'WP Super Cache',
			'wpsc'             => 'WP Super Cache',
			'litespeed'        => 'LiteSpeed Cache',
			'flyingpress'      => 'FlyingPress',
			'wp fastest cache' => 'WP Fastest Cache',
			'breeze'           => 'Breeze',
			'wp-optimize'      => 'WP-Optimize',
			'mamba'            => 'Mamba Cache',
			'powered cache'    => 'Powered Cache',
			'hummingbird'      => 'Hummingbird',
			'nitropack'        => 'NitroPack',
		);
		foreach ( $owners as $needle => $name ) {
			if ( str_contains( $contents, $needle ) ) {
				return $name;
			}
		}
		return __( 'another plugin', 'silo-connector' );
	}

	/**
	 * Dropin contents.
	 */
	public static function dropin_contents(): string {
		$serve = var_export( SILO_DIR . 'includes/serve.php', true ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_var_export
		return "<?php\n/**\n * Silo for WooCommerce page cache drop-in (" . self::DROPIN_MARKER . ").\n * Generated by the Silo connector plugin and removed automatically on deactivation.\n */\n\ndefined( 'ABSPATH' ) || exit;\n\n\$silo_serve = {$serve};\nif ( is_readable( \$silo_serve ) ) {\n\tinclude_once \$silo_serve;\n\tif ( function_exists( 'silo_serve_request' ) ) {\n\t\tsilo_serve_request( 'dropin' );\n\t}\n}\n";
	}

	/**
	 * Write our loader drop-in unless another plugin owns the file.
	 */
	public static function install_dropin(): bool {
		$status = self::dropin_status();
		if ( 'foreign' === $status ) {
			return false;
		}
		if ( 'ours' === $status ) {
			return true;
		}
		if ( ! wp_is_writable( WP_CONTENT_DIR ) && ! ( is_file( self::dropin_path() ) && wp_is_writable( self::dropin_path() ) ) ) {
			return false;
		}
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		return false !== file_put_contents( self::dropin_path(), self::dropin_contents() );
	}

	/**
	 * Remove dropin.
	 */
	public static function remove_dropin(): void {
		if ( in_array( self::dropin_status(), array( 'ours', 'stale' ), true ) ) {
			wp_delete_file( self::dropin_path() );
		}
	}

	/**
	 * WP config path.
	 */
	public static function wp_config_path(): string {
		if ( is_file( ABSPATH . 'wp-config.php' ) ) {
			return ABSPATH . 'wp-config.php';
		}
		$parent = dirname( ABSPATH ) . '/wp-config.php';
		if ( is_file( $parent ) && ! is_file( dirname( ABSPATH ) . '/wp-settings.php' ) ) {
			return $parent;
		}
		return '';
	}

	/**
	 * Turn on WP_CACHE so WordPress loads the drop-in. Remembers that Silo did it.
	 */
	public static function enable_wp_cache(): void {
		if ( defined( 'WP_CACHE' ) && WP_CACHE ) {
			return;
		}
		$path = self::wp_config_path();
		if ( '' === $path || ! wp_is_writable( $path ) ) {
			return;
		}

		$contents = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
		$pattern  = "/^\s*define\(\s*['\"]WP_CACHE['\"]\s*,\s*[^)]*\)\s*;.*$/mi";

		if ( preg_match( $pattern, $contents ) ) {
			$updated = (string) preg_replace( $pattern, "define( 'WP_CACHE', true ); " . self::CONFIG_MARKER, $contents, 1 );
		} else {
			$updated = (string) preg_replace( '/^<\?php\s*/', "<?php\ndefine( 'WP_CACHE', true ); " . self::CONFIG_MARKER . "\n", $contents, 1 );
		}

		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		if ( $updated !== $contents && false !== file_put_contents( $path, $updated ) ) {
			update_option( 'silo_added_wp_cache', 1, false );
		}
	}

	/**
	 * Disable WP cache.
	 */
	public static function disable_wp_cache(): void {
		if ( ! get_option( 'silo_added_wp_cache' ) ) {
			return;
		}
		$path = self::wp_config_path();
		if ( '' !== $path && wp_is_writable( $path ) ) {
			$contents = (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
			$updated  = (string) preg_replace( '/^.*' . preg_quote( self::CONFIG_MARKER, '/' ) . '.*\R?/m', '', $contents );
			if ( $updated !== $contents ) {
				file_put_contents( $path, $updated ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
			}
		}
		delete_option( 'silo_added_wp_cache' );
	}
}
