<?php
/**
 * Event reporter: hooks into ALL WooCommerce actions, POSTs signed payloads to SaaS.
 * Complete hook coverage for products, stock, orders, prices, taxonomy, coupons.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

class Silo_Event_Reporter {

	private static ?self $instance = null;
	private array $queued_events   = array();

	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	public function register_hooks(): void {
		if ( get_option( 'silo_events_enabled', '1' ) !== '1' ) {
			return;
		}

		// Product updates.
		add_action( 'woocommerce_update_product', array( $this, 'on_product_update' ), 10, 2 );
		add_action( 'woocommerce_new_product_variation', array( $this, 'on_variation_created' ), 10, 1 );
		add_action( 'woocommerce_save_product_variation', array( $this, 'on_variation_saved' ), 10, 2 );
		add_action( 'woocommerce_product_object_updated_props', array( $this, 'on_product_props_updated' ), 10, 2 );
		add_action( 'woocommerce_trash_product', array( $this, 'on_product_trashed' ), 10, 1 );
		add_action( 'before_delete_post', array( $this, 'on_product_deleted' ), 10, 1 );

		// Stock changes.
		add_action( 'woocommerce_product_set_stock', array( $this, 'on_stock_change' ), 10, 1 );
		add_action( 'woocommerce_variation_set_stock', array( $this, 'on_stock_change' ), 10, 1 );
		add_action( 'woocommerce_product_set_stock_status', array( $this, 'on_stock_status_change' ), 10, 3 );

		// Order status changes.
		add_action( 'woocommerce_order_status_changed', array( $this, 'on_order_status_changed' ), 10, 4 );
		add_action( 'woocommerce_order_refunded', array( $this, 'on_order_refunded' ), 10, 2 );
		add_action( 'woocommerce_reduce_order_stock', array( $this, 'on_order_stock_reduced' ), 10, 1 );
		add_action( 'woocommerce_restore_order_stock', array( $this, 'on_order_stock_restored' ), 10, 1 );

		// Sale price scheduling.
		add_action( 'woocommerce_scheduled_sales', array( $this, 'on_scheduled_sales' ) );

		// Taxonomy changes.
		add_action( 'edited_product_cat', array( $this, 'on_category_changed' ), 10, 2 );
		add_action( 'created_product_cat', array( $this, 'on_category_changed' ), 10, 2 );
		add_action( 'delete_product_cat', array( $this, 'on_category_deleted' ), 10, 4 );
		add_action( 'edited_product_tag', array( $this, 'on_tag_changed' ), 10, 2 );
		add_action( 'created_product_tag', array( $this, 'on_tag_changed' ), 10, 2 );
		add_action( 'delete_product_tag', array( $this, 'on_tag_deleted' ), 10, 4 );
		add_action( 'set_object_terms', array( $this, 'on_object_terms_set' ), 10, 6 );

		// Coupon changes.
		add_action( 'woocommerce_update_coupon', array( $this, 'on_coupon_updated' ), 10, 2 );
		add_action( 'woocommerce_trash_coupon', array( $this, 'on_coupon_trashed' ), 10, 1 );
		add_action( 'woocommerce_coupon_object_updated_props', array( $this, 'on_coupon_props_updated' ), 10, 2 );

		// Flush at shutdown.
		add_action( 'shutdown', array( $this, 'flush_events' ) );
	}

	// -- Product hooks --------------------------------------------------

	public function on_product_update( int $product_id, $product ): void {
		if ( ! $product instanceof \WC_Product ) {
			return;
		}
		$this->queue_event( 'product_updated', array(
			'product_id'   => $product_id,
			'product_type' => $product->get_type(),
			'name'         => $product->get_name(),
			'sku'          => $product->get_sku(),
			'url'          => get_permalink( $product_id ),
			'categories'   => $this->get_product_category_urls( $product_id ),
			'tags'         => $this->get_product_tag_urls( $product_id ),
			'parent_id'    => $product->get_parent_id(),
		) );
	}

	public function on_variation_created( int $variation_id ): void {
		$variation = wc_get_product( $variation_id );
		if ( ! $variation ) {
			return;
		}

		$this->queue_event( 'variation_created', array(
			'variation_id' => $variation_id,
			'parent_id'    => $variation->get_parent_id(),
			'url'          => get_permalink( $variation->get_parent_id() ),
			'sku'          => $variation->get_sku(),
		) );
	}

	public function on_variation_saved( int $variation_id, int $loop_index ): void {
		$variation = wc_get_product( $variation_id );
		if ( ! $variation ) {
			return;
		}

		$this->queue_event( 'variation_updated', array(
			'variation_id' => $variation_id,
			'parent_id'    => $variation->get_parent_id(),
			'url'          => get_permalink( $variation->get_parent_id() ),
			'sku'          => $variation->get_sku(),
		) );
	}

	public function on_product_props_updated( \WC_Product $product, array $updated_props ): void {
		$watched  = array( 'regular_price', 'sale_price', 'date_on_sale_from', 'date_on_sale_to', 'stock_quantity', 'stock_status', 'attributes', 'visibility', 'featured' );
		$relevant = array_intersect( $updated_props, $watched );

		if ( empty( $relevant ) ) {
			return;
		}

		$product_id = $product->get_id();
		$this->queue_event( 'product_props_updated', array(
			'product_id'    => $product_id,
			'product_type'  => $product->get_type(),
			'updated_props' => array_values( $relevant ),
			'url'           => get_permalink( $product_id ),
			'categories'    => $this->get_product_category_urls( $product_id ),
		) );
	}

	public function on_product_trashed( int $product_id ): void {
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return;
		}

		$this->queue_event( 'product_trashed', array(
			'product_id' => $product_id,
			'name'       => $product->get_name(),
			'url'        => get_permalink( $product_id ),
			'categories' => $this->get_product_category_urls( $product_id ),
			'tags'       => $this->get_product_tag_urls( $product_id ),
		) );
	}

	public function on_product_deleted( int $post_id ): void {
		if ( 'product' !== get_post_type( $post_id ) ) {
			return;
		}
		$this->queue_event( 'product_deleted', array(
			'product_id' => $post_id,
			'url'        => get_permalink( $post_id ),
		) );
	}

	// -- Stock hooks ----------------------------------------------------

	public function on_stock_change( \WC_Product $product ): void {
		$product_id = $product->get_id();
		$parent_id  = $product->get_parent_id();
		$target_id  = $parent_id ?: $product_id;

		$this->queue_event( 'stock_changed', array(
			'product_id'     => $product_id,
			'product_type'   => $product->get_type(),
			'parent_id'      => $parent_id,
			'sku'            => $product->get_sku(),
			'name'           => $product->get_name(),
			'stock_quantity' => $product->get_stock_quantity(),
			'stock_status'   => $product->get_stock_status(),
			'managing_stock' => $product->get_manage_stock(),
			'url'            => get_permalink( $target_id ),
			'categories'     => $this->get_product_category_urls( $target_id ),
		) );
	}

	public function on_stock_status_change( int $product_id, string $stock_status, \WC_Product $product ): void {
		$parent_id = $product->get_parent_id();
		$target_id = $parent_id ?: $product_id;

		$this->queue_event( 'stock_status_changed', array(
			'product_id'   => $product_id,
			'parent_id'    => $parent_id,
			'stock_status' => $stock_status,
			'name'         => $product->get_name(),
			'url'          => get_permalink( $target_id ),
			'categories'   => $this->get_product_category_urls( $target_id ),
		) );
	}

	// -- Order hooks ----------------------------------------------------

	public function on_order_status_changed( int $order_id, string $from, string $to, \WC_Order $order ): void {
		$products = array();
		foreach ( $order->get_items() as $item ) {
			if ( $item instanceof \WC_Order_Item_Product ) {
				$pid        = $item->get_product_id();
				$products[] = array(
					'product_id'   => $pid,
					'variation_id' => $item->get_variation_id() ?: null,
					'quantity'     => $item->get_quantity(),
					'url'          => get_permalink( $pid ),
					'categories'   => $this->get_product_category_urls( $pid ),
				);
			}
		}

		$this->queue_event( 'order_status_changed', array(
			'order_id' => $order_id,
			'from'     => $from,
			'to'       => $to,
			'products' => $products,
		) );
	}

	public function on_order_refunded( int $order_id, int $refund_id ): void {
		$order = wc_get_order( $order_id );
		if ( ! $order ) {
			return;
		}

		$product_ids = array();
		foreach ( $order->get_items() as $item ) {
			if ( $item instanceof \WC_Order_Item_Product ) {
				$product_ids[] = $item->get_product_id();
			}
		}

		$this->queue_event( 'order_refunded', array(
			'order_id'    => $order_id,
			'refund_id'   => $refund_id,
			'product_ids' => $product_ids,
		) );
	}

	public function on_order_stock_reduced( \WC_Order $order ): void {
		$this->queue_event( 'order_stock_reduced', array(
			'order_id' => $order->get_id(),
		) );
	}

	public function on_order_stock_restored( \WC_Order $order ): void {
		$this->queue_event( 'order_stock_restored', array(
			'order_id' => $order->get_id(),
		) );
	}

	// -- Sale hooks -----------------------------------------------------

	public function on_scheduled_sales(): void {
		$urls = $this->get_sale_transition_urls();
		if ( ! empty( $urls ) ) {
			$this->queue_event( 'sale_boundary', array(
				'type'         => 'scheduled_sales_processed',
				'product_urls' => $urls,
			) );
		}
	}

	private function get_sale_transition_urls(): array {
		$urls   = array();
		$now    = current_time( 'timestamp', true );
		$window = 120;

		$query = new \WP_Query( array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => 50,
			'meta_query'     => array( // phpcs:ignore WordPress.DB.SlowDBQuery
				'relation' => 'OR',
				array(
					'key'     => '_sale_price_dates_from',
					'value'   => array( $now - $window, $now + $window ),
					'compare' => 'BETWEEN',
					'type'    => 'NUMERIC',
				),
				array(
					'key'     => '_sale_price_dates_to',
					'value'   => array( $now - $window, $now + $window ),
					'compare' => 'BETWEEN',
					'type'    => 'NUMERIC',
				),
			),
		) );

		foreach ( $query->posts as $post ) {
			$url = get_permalink( $post->ID );
			if ( $url ) {
				$urls[] = $url;
			}
			$urls = array_merge( $urls, $this->get_product_category_urls( $post->ID ) );
		}

		return array_values( array_unique( $urls ) );
	}

	// -- Taxonomy hooks -------------------------------------------------

	public function on_category_changed( int $term_id, int $tt_id ): void {
		$url = get_term_link( $term_id, 'product_cat' );
		$this->queue_event( 'category_changed', array(
			'term_id' => $term_id,
			'url'     => is_wp_error( $url ) ? '' : $url,
		) );
	}

	public function on_category_deleted( int $term_id, int $tt_id, $deleted_term, array $object_ids ): void {
		$this->queue_event( 'category_deleted', array(
			'term_id'      => $term_id,
			'product_ids'  => $object_ids,
		) );
	}

	public function on_tag_changed( int $term_id, int $tt_id ): void {
		$url = get_term_link( $term_id, 'product_tag' );
		$this->queue_event( 'tag_changed', array(
			'term_id' => $term_id,
			'url'     => is_wp_error( $url ) ? '' : $url,
		) );
	}

	public function on_tag_deleted( int $term_id, int $tt_id, $deleted_term, array $object_ids ): void {
		$this->queue_event( 'tag_deleted', array(
			'term_id'     => $term_id,
			'product_ids' => $object_ids,
		) );
	}

	public function on_object_terms_set( int $object_id, array $terms, array $tt_ids, string $taxonomy, bool $append, array $old_tt_ids ): void {
		if ( ! in_array( $taxonomy, array( 'product_cat', 'product_tag' ), true ) ) {
			return;
		}
		if ( 'product' !== get_post_type( $object_id ) ) {
			return;
		}

		$this->queue_event( 'product_terms_changed', array(
			'product_id' => $object_id,
			'taxonomy'   => $taxonomy,
			'url'        => get_permalink( $object_id ),
			'categories' => $this->get_product_category_urls( $object_id ),
			'tags'       => $this->get_product_tag_urls( $object_id ),
		) );
	}

	// -- Coupon hooks ---------------------------------------------------

	public function on_coupon_updated( int $coupon_id, $coupon ): void {
		$this->queue_event( 'coupon_updated', array(
			'coupon_id'   => $coupon_id,
			'coupon_code' => $coupon instanceof \WC_Coupon ? $coupon->get_code() : '',
		) );
	}

	public function on_coupon_trashed( int $coupon_id ): void {
		$this->queue_event( 'coupon_trashed', array(
			'coupon_id' => $coupon_id,
		) );
	}

	public function on_coupon_props_updated( \WC_Coupon $coupon, array $updated_props ): void {
		$this->queue_event( 'coupon_props_updated', array(
			'coupon_id'     => $coupon->get_id(),
			'coupon_code'   => $coupon->get_code(),
			'updated_props' => $updated_props,
		) );
	}

	// -- Queue & flush --------------------------------------------------

	private function queue_event( string $type, array $payload ): void {
		$dedup_key = $type . ':' . ( $payload['product_id'] ?? $payload['order_id'] ?? $payload['term_id'] ?? $payload['coupon_id'] ?? 'global' );

		if ( isset( $this->queued_events[ $dedup_key ] ) ) {
			return;
		}

		$this->queued_events[ $dedup_key ] = array(
			'type'      => $type,
			'payload'   => $payload,
			'timestamp' => time(),
		);
	}

	public function flush_events(): void {
		if ( empty( $this->queued_events ) ) {
			return;
		}

		$saas_url = silo()->get_saas_url();
		$endpoint = $saas_url . '/api/events';

		foreach ( $this->queued_events as $event ) {
			$body    = wp_json_encode( $event );
			$headers = silo()->sign_request( $body );

			$response = wp_remote_post( $endpoint, array(
				'timeout' => 15,
				'headers' => $headers,
				'body'    => $body,
			) );

			if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) >= 500 ) {
				usleep( 500000 );
				$body    = wp_json_encode( $event );
				$headers = silo()->sign_request( $body );
				$response = wp_remote_post( $endpoint, array(
					'timeout' => 15,
					'headers' => $headers,
					'body'    => $body,
				) );
			}

			if ( is_wp_error( $response ) ) {
				$this->log_activity( $event['type'], 'POST failed: ' . $response->get_error_message() );
				continue;
			}

			$status = wp_remote_retrieve_response_code( $response );
			$result = json_decode( wp_remote_retrieve_body( $response ), true );

			$this->log_activity(
				$event['type'],
				'HTTP ' . $status . ' — purge:' . count( $result['purge'] ?? array() ) . ' warm:' . count( $result['warm'] ?? array() )
			);

			if ( 200 === $status && ! empty( $result['purge'] ) ) {
				silo()->page_cache()->purge_urls( $result['purge'] );
			}

			if ( 200 === $status && ! empty( $result['warm'] ) ) {
				silo()->warmup()->warm_urls( $result['warm'] );
			}

			if ( 429 === $status ) {
				break;
			}
		}

		$this->queued_events = array();
	}

	private function log_activity( string $event, string $detail ): void {
		$log_file = SILO_CACHE_DIR . '.activity.log';
		$line     = gmdate( 'Y-m-d H:i:s' ) . '|' . $event . '|' . $detail . "\n";
		file_put_contents( $log_file, $line, FILE_APPEND | LOCK_EX ); // phpcs:ignore

		if ( file_exists( $log_file ) && wp_rand( 1, 20 ) === 1 ) {
			$lines = file( $log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES );
			if ( $lines && count( $lines ) > 500 ) {
				$lines = array_slice( $lines, -500 );
				file_put_contents( $log_file, implode( "\n", $lines ) . "\n", LOCK_EX ); // phpcs:ignore
			}
		}
	}

	// -- URL helpers ----------------------------------------------------

	private function get_product_category_urls( int $product_id ): array {
		$terms = get_the_terms( $product_id, 'product_cat' );
		if ( ! $terms || is_wp_error( $terms ) ) {
			return array();
		}

		$urls = array();
		foreach ( $terms as $term ) {
			$url = get_term_link( $term );
			if ( ! is_wp_error( $url ) ) {
				$urls[] = $url;
			}
		}
		return $urls;
	}

	private function get_product_tag_urls( int $product_id ): array {
		$terms = get_the_terms( $product_id, 'product_tag' );
		if ( ! $terms || is_wp_error( $terms ) ) {
			return array();
		}

		$urls = array();
		foreach ( $terms as $term ) {
			$url = get_term_link( $term );
			if ( ! is_wp_error( $url ) ) {
				$urls[] = $url;
			}
		}
		return $urls;
	}
}
