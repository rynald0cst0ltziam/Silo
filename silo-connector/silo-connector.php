<?php
/**
 * Plugin Name:          Silo for WooCommerce
 * Plugin URI:           https://heysilo.co
 * Description:          Inventory-aware page and Store API cache for WooCommerce. Surgical invalidation and priority warmup, orchestrated by Silo.
 * Version:              2.3.2
 * Requires at least:    6.4
 * Requires PHP:         8.1
 * Requires Plugins:     woocommerce
 * Author:               Silo
 * Author URI:           https://heysilo.co
 * License:              GPL-2.0-or-later
 * License URI:          https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:          silo-connector
 * WC requires at least: 8.2
 * WC tested up to:      9.9
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// A second copy of the connector (for example an older upload in another folder) must not load.
if ( defined( 'SILO_VERSION' ) ) {
	add_action(
		'admin_notices',
		static function () {
			echo '<div class="notice notice-error"><p>' . esc_html__( 'Another copy of Silo for WooCommerce is already active. Deactivate and delete the duplicate under Plugins.', 'silo-connector' ) . '</p></div>';
		}
	);
	return;
}

define( 'SILO_VERSION', '2.3.2' );
define( 'SILO_FILE', __FILE__ );
define( 'SILO_DIR', plugin_dir_path( __FILE__ ) );
define( 'SILO_URL', plugin_dir_url( __FILE__ ) );
define( 'SILO_BASENAME', plugin_basename( __FILE__ ) );

require_once SILO_DIR . 'includes/cache-key.php';
require_once SILO_DIR . 'includes/class-silo-settings.php';
require_once SILO_DIR . 'includes/class-silo-api.php';
require_once SILO_DIR . 'includes/class-silo-installer.php';
require_once SILO_DIR . 'includes/class-silo-stats.php';
require_once SILO_DIR . 'includes/class-silo-log.php';
require_once SILO_DIR . 'includes/class-silo-compat.php';
require_once SILO_DIR . 'includes/class-silo-page-cache.php';
require_once SILO_DIR . 'includes/class-silo-store-api-cache.php';
require_once SILO_DIR . 'includes/class-silo-warmup.php';
require_once SILO_DIR . 'includes/class-silo-fragments.php';
require_once SILO_DIR . 'includes/class-silo-sales.php';
require_once SILO_DIR . 'includes/class-silo-events.php';
require_once SILO_DIR . 'includes/class-silo-scanner.php';
require_once SILO_DIR . 'includes/class-silo-heartbeat.php';
require_once SILO_DIR . 'includes/class-silo-status.php';
require_once SILO_DIR . 'includes/class-silo-rest.php';
require_once SILO_DIR . 'includes/class-silo-admin.php';

register_activation_hook( __FILE__, array( 'Silo_Installer', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'Silo_Installer', 'deactivate' ) );

add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', SILO_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', SILO_FILE, true );
		}
	}
);

// When another plugin owns advanced-cache.php, serve from here as early as plugins allow.
add_action( 'plugins_loaded', array( 'Silo_Page_Cache', 'late_serve' ), 1 );
add_action( 'plugins_loaded', 'silo_boot', 20 );

/**
 * Wire every component once WooCommerce is available.
 */
function silo_boot(): void {
	if ( ! class_exists( 'WooCommerce' ) ) {
		add_action( 'admin_notices', array( 'Silo_Admin', 'notice_missing_woocommerce' ) );
		return;
	}

	Silo_Installer::maybe_upgrade();

	Silo_Heartbeat::init();
	Silo_Warmup::init();
	Silo_Scanner::init();
	Silo_Events::init();
	Silo_Compat::init();
	Silo_Page_Cache::init();
	Silo_Store_API_Cache::init();
	Silo_Fragments::init();
	Silo_Sales::init();
	Silo_Rest::init();

	if ( is_admin() ) {
		Silo_Admin::init();
	}
}
