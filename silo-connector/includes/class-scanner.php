<?php
/**
 * Scanner: builds store snapshot for initial connection.
 * Reports progress via AJAX for animated UI.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Scanner {

	private static ?self $instance = null;

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function run_scan(): array {
		$snapshot = array(
			'started_at' => gmdate( 'Y-m-d H:i:s' ),
			'wp_version' => get_bloginfo( 'version' ),
			'wc_version' => defined( 'WC_VERSION' ) ? WC_VERSION : 'unknown',
			'php_version' => PHP_VERSION,
			'site_url'    => get_site_url(),
			'store_url'   => home_url( '/' ),
			'timezone'    => wp_timezone_string(),
			'locale'      => get_locale(),
		);

		$snapshot['products']    = $this->scan_products();
		$snapshot['categories']  = $this->scan_categories();
		$snapshot['variations']  = $this->scan_variations();
		$snapshot['stock']       = $this->scan_stock();
		$snapshot['features']    = $this->detect_features();
		$snapshot['urls']        = $this->collect_warmup_urls();
		$snapshot['completed_at'] = gmdate( 'Y-m-d H:i:s' );

		update_option( 'silo_last_scan', $snapshot, false );

		return $snapshot;
	}

	public function get_scan_progress(): array {
		return get_option( 'silo_scan_progress', array(
			'stage'   => 'idle',
			'percent' => 0,
			'message' => '',
		) );
	}

	private function update_progress( string $stage, int $percent, string $message ): void {
		update_option( 'silo_scan_progress', array(
			'stage'   => $stage,
			'percent' => min( 100, $percent ),
			'message' => $message,
		), false );
	}

	private function scan_products(): array {
		$this->update_progress( 'products', 10, 'Scanning products...' );

		$counts = wp_count_posts( 'product' );
		$total  = (int) ( $counts->publish ?? 0 );

		$types = array();
		if ( function_exists( 'wc_get_product_types' ) ) {
			$registered = wc_get_product_types();
			foreach ( $registered as $slug => $label ) {
				$count = $this->count_products_by_type( $slug );
				if ( $count > 0 ) {
					$types[ $slug ] = $count;
				}
			}
		}

		$this->update_progress( 'products', 25, sprintf( '%s products found', number_format_i18n( $total ) ) );

		return array(
			'total'    => $total,
			'types'    => $types,
			'drafts'   => (int) ( $counts->draft ?? 0 ),
			'featured' => $this->count_featured_products(),
			'on_sale'  => $this->count_on_sale_products(),
		);
	}

	private function scan_categories(): array {
		$this->update_progress( 'categories', 35, 'Scanning categories...' );

		$terms = get_terms( array(
			'taxonomy'   => 'product_cat',
			'hide_empty' => false,
			'fields'     => 'count',
		) );

		$cat_count = is_wp_error( $terms ) ? 0 : (int) $terms;

		$tags = get_terms( array(
			'taxonomy'   => 'product_tag',
			'hide_empty' => false,
			'fields'     => 'count',
		) );

		$tag_count = is_wp_error( $tags ) ? 0 : (int) $tags;

		return array(
			'categories' => $cat_count,
			'tags'       => $tag_count,
		);
	}

	private function scan_variations(): array {
		$this->update_progress( 'variations', 50, 'Detecting variants...' );

		global $wpdb;
		$variation_count = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product_variation' AND post_status = 'publish'"
		);

		$variable_count = $this->count_products_by_type( 'variable' );

		return array(
			'total_variations'   => $variation_count,
			'variable_products'  => $variable_count,
			'avg_per_product'    => $variable_count > 0 ? round( $variation_count / $variable_count, 1 ) : 0,
		);
	}

	private function scan_stock(): array {
		$this->update_progress( 'stock', 65, 'Analyzing stock management...' );

		global $wpdb;
		$managing = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_manage_stock' AND meta_value = 'yes'"
		);

		$out_of_stock = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_stock_status' AND meta_value = 'outofstock'"
		);

		$backorder = (int) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_backorders' AND meta_value != 'no'"
		);

		$low_stock_threshold = get_option( 'woocommerce_notify_low_stock_amount', 2 );

		return array(
			'managing_stock' => $managing,
			'out_of_stock'   => $out_of_stock,
			'on_backorder'   => $backorder,
			'low_stock_threshold' => (int) $low_stock_threshold,
		);
	}

	private function detect_features(): array {
		$this->update_progress( 'features', 80, 'Building invalidation graph...' );

		return array(
			'hpos'          => $this->is_hpos_enabled(),
			'multicurrency' => class_exists( 'WCML_Multi_Currency' ) || class_exists( 'WOOCS' ),
			'multilingual'  => defined( 'ICL_SITEPRESS_VERSION' ) || function_exists( 'pll_current_language' ),
			'subscriptions' => class_exists( 'WC_Subscriptions' ),
			'bookings'      => class_exists( 'WC_Bookings' ),
			'memberships'   => class_exists( 'WC_Memberships' ),
			'bundles'       => class_exists( 'WC_Bundles' ),
			'composites'    => class_exists( 'WC_Product_Composite' ),
			'blocks_cart'   => $this->uses_block_checkout(),
			'store_api'     => true,
			'caching_plugin' => $this->detect_other_caching(),
		);
	}

	private function collect_warmup_urls(): array {
		$this->update_progress( 'urls', 90, 'Collecting warmup URLs...' );

		$urls = array( home_url( '/' ) );

		if ( function_exists( 'wc_get_page_id' ) ) {
			$shop_id = wc_get_page_id( 'shop' );
			if ( $shop_id > 0 ) {
				$url = get_permalink( $shop_id );
				if ( $url ) {
					$urls[] = $url;
				}
			}
		}

		$categories = get_terms( array(
			'taxonomy'   => 'product_cat',
			'orderby'    => 'count',
			'order'      => 'DESC',
			'number'     => 10,
			'hide_empty' => true,
		) );
		if ( ! is_wp_error( $categories ) ) {
			foreach ( $categories as $cat ) {
				$url = get_term_link( $cat );
				if ( ! is_wp_error( $url ) ) {
					$urls[] = $url;
				}
			}
		}

		$bestsellers = $this->get_bestseller_ids( 20 );
		foreach ( $bestsellers as $pid ) {
			$url = get_permalink( $pid );
			if ( $url ) {
				$urls[] = $url;
			}
		}

		$this->update_progress( 'complete', 100, 'Scan complete' );

		return array_values( array_unique( array_filter( $urls ) ) );
	}

	public function get_bestseller_ids( int $limit = 20 ): array {
		global $wpdb;

		if ( $this->is_hpos_enabled() ) {
			$table = $wpdb->prefix . 'wc_order_product_lookup';
			if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) { // phpcs:ignore
				return $wpdb->get_col( $wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
					"SELECT product_id FROM {$table} GROUP BY product_id ORDER BY SUM(product_qty) DESC LIMIT %d",
					$limit
				) );
			}
		}

		return $wpdb->get_col( $wpdb->prepare( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			"SELECT oi.meta_value as pid
			FROM {$wpdb->prefix}woocommerce_order_itemmeta oi
			JOIN {$wpdb->prefix}woocommerce_order_items i ON oi.order_item_id = i.order_item_id
			WHERE oi.meta_key = '_product_id'
			GROUP BY pid
			ORDER BY SUM(
				(SELECT meta_value FROM {$wpdb->prefix}woocommerce_order_itemmeta
				 WHERE order_item_id = oi.order_item_id AND meta_key = '_qty')
			) DESC
			LIMIT %d",
			$limit
		) );
	}

	private function count_products_by_type( string $type ): int {
		$term = get_term_by( 'slug', $type, 'product_type' );
		if ( ! $term || is_wp_error( $term ) ) {
			return 0;
		}
		return (int) $term->count;
	}

	private function count_featured_products(): int {
		$term = get_term_by( 'name', 'featured', 'product_visibility' );
		return $term && ! is_wp_error( $term ) ? (int) $term->count : 0;
	}

	private function count_on_sale_products(): int {
		if ( function_exists( 'wc_get_product_ids_on_sale' ) ) {
			return count( wc_get_product_ids_on_sale() );
		}
		return 0;
	}

	private function is_hpos_enabled(): bool {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) ) {
			return \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		}
		return false;
	}

	private function uses_block_checkout(): bool {
		if ( ! function_exists( 'wc_get_page_id' ) ) {
			return false;
		}
		$checkout_id = wc_get_page_id( 'checkout' );
		if ( $checkout_id <= 0 ) {
			return false;
		}
		$content = get_post_field( 'post_content', $checkout_id );
		return str_contains( $content, 'woocommerce/checkout' );
	}

	private function detect_other_caching(): string {
		$plugins = array(
			'w3-total-cache/w3-total-cache.php'            => 'W3 Total Cache',
			'wp-super-cache/wp-cache.php'                  => 'WP Super Cache',
			'wp-fastest-cache/wpFastestCache.php'          => 'WP Fastest Cache',
			'litespeed-cache/litespeed-cache.php'          => 'LiteSpeed Cache',
			'wp-rocket/wp-rocket.php'                      => 'WP Rocket',
			'breeze/breeze.php'                            => 'Breeze',
			'sg-cachepress/sg-cachepress.php'              => 'SG Optimizer',
			'powered-cache/powered-cache.php'              => 'Powered Cache',
			'nitropack/main.php'                           => 'NitroPack',
			'mamba-cache-for-woocommerce/mamba-cache.php'  => 'Mamba Cache',
		);

		$active = array();
		foreach ( $plugins as $file => $name ) {
			if ( is_plugin_active( $file ) ) {
				$active[] = $name;
			}
		}

		return implode( ', ', $active ) ?: 'none';
	}
}
