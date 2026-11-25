<?php
/**
 * WooCommerce event pipeline.
 *
 * 1. Hooks collect every catalog change made during a request (admin save, REST,
 *    order stock reduction, refund, scheduled sale, term edit...).
 * 2. At shutdown the changes are consolidated: one event per product, one per order,
 *    one per term. No-op saves produce nothing.
 * 3. The affected URLs and Store API entries are purged on the store immediately,
 *    so correctness never waits on the network.
 * 4. The events are sent to Silo in one batch, in the background. Silo resolves the
 *    full invalidation scope and the warmup plan; the connector applies the extra purges
 *    and queues the warmup.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery

/**
 * Event collection, local invalidation and dispatch.
 */
class Silo_Events {

	const DISPATCH_HOOK = 'silo_dispatch_events';

	const STOCK_PROPS      = array( 'stock_quantity', 'stock_status', 'manage_stock', 'backorders', 'low_stock_amount' );
	const PRICE_PROPS      = array( 'regular_price', 'sale_price', 'price', 'date_on_sale_from', 'date_on_sale_to' );
	const VISIBILITY_PROPS = array( 'catalog_visibility', 'featured', 'status' );

	const WATCHED_OPTIONS = array(
		'woocommerce_currency',
		'woocommerce_currency_pos',
		'woocommerce_price_thousand_sep',
		'woocommerce_price_decimal_sep',
		'woocommerce_price_num_decimals',
		'woocommerce_tax_display_shop',
		'woocommerce_prices_include_tax',
		'woocommerce_price_display_suffix',
		'woocommerce_hide_out_of_stock_items',
		'woocommerce_catalog_columns',
		'woocommerce_catalog_rows',
		'woocommerce_default_catalog_orderby',
		'woocommerce_shop_page_display',
		'woocommerce_category_archive_display',
		'woocommerce_shop_page_id',
		'woocommerce_permalinks',
		'woocommerce_stock_format',
		'woocommerce_enable_reviews',
		'woocommerce_enable_review_rating',
		'woocommerce_default_country',
		'woocommerce_calc_taxes',
	);

	/**
	 * Products changed in this request, keyed by parent/product ID.
	 *
	 * @var array<int,array>
	 */
	private static $products = array();

	/**
	 * Orders that moved stock in this request.
	 *
	 * @var array<int,array>
	 */
	private static $orders = array();

	/**
	 * Terms changed in this request.
	 *
	 * @var array<int,array>
	 */
	private static $terms = array();

	/**
	 * Term links captured before an edit or delete changes them.
	 *
	 * @var array<int,string>
	 */
	private static $term_links = array();

	/**
	 * Site-wide changes (settings, theme) that require a full purge.
	 *
	 * @var array<string,array>
	 */
	private static $global = array();

	/**
	 * Whether the shutdown flush is registered.
	 *
	 * @var bool
	 */
	private static $registered = false;

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( self::DISPATCH_HOOK, array( __CLASS__, 'dispatch' ) );

		if ( ! Silo_Settings::is_connected() ) {
			return;
		}

		// Products and variations.
		add_action( 'woocommerce_new_product', array( __CLASS__, 'on_new_product' ), 20, 2 );
		add_action( 'woocommerce_new_product_variation', array( __CLASS__, 'on_new_variation' ), 20, 2 );
		add_action( 'woocommerce_product_object_updated_props', array( __CLASS__, 'on_updated_props' ), 20, 2 );
		add_action( 'post_updated', array( __CLASS__, 'on_post_updated' ), 20, 3 );
		add_action( 'transition_post_status', array( __CLASS__, 'on_status_transition' ), 20, 3 );
		add_action( 'woocommerce_product_set_visibility', array( __CLASS__, 'on_visibility' ), 20, 1 );
		add_action( 'wp_trash_post', array( __CLASS__, 'on_before_remove' ), 5 );
		add_action( 'before_delete_post', array( __CLASS__, 'on_before_remove' ), 5 );
		add_action( 'untrashed_post', array( __CLASS__, 'on_untrashed' ), 20 );

		// Stock.
		add_action( 'woocommerce_product_set_stock', array( __CLASS__, 'on_stock' ), 20 );
		add_action( 'woocommerce_variation_set_stock', array( __CLASS__, 'on_stock' ), 20 );
		add_action( 'woocommerce_product_set_stock_status', array( __CLASS__, 'on_stock_status' ), 20, 3 );
		add_action( 'woocommerce_variation_set_stock_status', array( __CLASS__, 'on_stock_status' ), 20, 3 );

		// Orders that move stock (HPOS and legacy storage fire the same hooks).
		add_action( 'woocommerce_reduce_order_stock', array( __CLASS__, 'on_order_stock_reduced' ), 20 );
		add_action( 'woocommerce_restore_order_stock', array( __CLASS__, 'on_order_stock_restored' ), 20 );
		add_action( 'woocommerce_order_refunded', array( __CLASS__, 'on_order_refunded' ), 20, 2 );

		// Taxonomies: categories, tags, brands, attribute terms.
		add_action( 'set_object_terms', array( __CLASS__, 'on_object_terms' ), 20, 6 );
		add_action( 'edit_term', array( __CLASS__, 'capture_term_link' ), 5, 3 );
		add_action( 'pre_delete_term', array( __CLASS__, 'capture_term_link_delete' ), 5, 2 );
		add_action( 'edited_term', array( __CLASS__, 'on_term_edited' ), 20, 3 );
		add_action( 'delete_term', array( __CLASS__, 'on_term_deleted' ), 20, 4 );
		add_action( 'created_term', array( __CLASS__, 'on_term_created' ), 20, 3 );

		// Reviews change the product page and rating sort order.
		add_action( 'comment_post', array( __CLASS__, 'on_comment_post' ), 20, 2 );
		add_action( 'transition_comment_status', array( __CLASS__, 'on_comment_status' ), 20, 3 );

		// Store-wide changes.
		add_action( 'updated_option', array( __CLASS__, 'on_option' ), 20, 3 );
		add_action( 'switch_theme', array( __CLASS__, 'on_theme_change' ) );
		add_action( 'wp_update_nav_menu', array( __CLASS__, 'on_layout_change' ) );
		add_action( 'save_post', array( __CLASS__, 'on_template_saved' ), 20, 2 );
		add_action( 'elementor/editor/after_save', array( __CLASS__, 'on_builder_saved' ) );
		add_action( 'customize_save_after', array( __CLASS__, 'on_theme_change' ) );
		add_action( 'upgrader_process_complete', array( __CLASS__, 'on_upgrade' ), 20, 2 );
	}

	// Collection.

	/**
	 * Register flush.
	 */
	private static function register_flush(): void {
		if ( ! self::$registered ) {
			self::$registered = true;
			add_action( 'shutdown', array( __CLASS__, 'flush' ), 5 );
		}
	}

	/**
	 * Record a change against the product (variations roll up to their parent).
	 *
	 * @param WC_Product|int $product Product or ID.
	 * @param string         $reason  Why it changed.
	 * @param string[]       $props   Changed properties.
	 */
	private static function touch( $product, string $reason, array $props = array() ): void {
		$product = $product instanceof WC_Product ? $product : wc_get_product( $product );
		if ( ! $product ) {
			return;
		}

		$id        = $product->get_id();
		$parent_id = $product->get_parent_id();
		$root      = $parent_id > 0 ? $parent_id : $id;

		if ( ! isset( self::$products[ $root ] ) ) {
			self::$products[ $root ] = array(
				'reasons'    => array(),
				'props'      => array(),
				'variations' => array(),
				'old_terms'  => array(),
				'context'    => self::context(),
				'snapshot'   => null,
			);
		}

		self::$products[ $root ]['reasons'][ $reason ] = true;
		self::$products[ $root ]['props']              = array_values( array_unique( array_merge( self::$products[ $root ]['props'], $props ) ) );
		if ( $parent_id > 0 ) {
			self::$products[ $root ]['variations'][ $id ] = true;
		}
		self::register_flush();
	}

	/**
	 * Context.
	 */
	private static function context(): string {
		if ( doing_action( 'woocommerce_scheduled_sales' ) || doing_action( Silo_Sales::HOOK ) ) {
			return 'scheduled_sale';
		}
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return 'rest';
		}
		if ( defined( 'WP_CLI' ) && WP_CLI ) {
			return 'cli';
		}
		if ( wp_doing_cron() ) {
			return 'cron';
		}
		if ( wp_doing_ajax() ) {
			return 'ajax';
		}
		return is_admin() ? 'admin' : 'storefront';
	}

	/**
	 * Whether product post.
	 *
	 * @param int $post_id Post ID.
	 */
	private static function is_product_post( int $post_id ): bool {
		return in_array( get_post_type( $post_id ), array( 'product', 'product_variation' ), true );
	}

	/**
	 * Hook callback: new product.
	 *
	 * @param int        $id      Product ID.
	 * @param WC_Product $product Product.
	 */
	public static function on_new_product( $id, $product = null ): void {
		self::touch( $product instanceof WC_Product ? $product : (int) $id, 'created' );
	}

	/**
	 * Hook callback: new variation.
	 *
	 * @param int        $id        Variation ID.
	 * @param WC_Product $variation Variation.
	 */
	public static function on_new_variation( $id, $variation = null ): void {
		self::touch( $variation instanceof WC_Product ? $variation : (int) $id, 'variations' );
	}

	/**
	 * Fires with the meta-backed properties that actually changed on save.
	 *
	 * @param WC_Product $product Product.
	 * @param string[]   $props   Changed props.
	 */
	public static function on_updated_props( $product, $props ): void {
		$props = array_values( array_filter( (array) $props, 'is_string' ) );
		if ( $product instanceof WC_Product && $props ) {
			self::touch( $product, 'props', $props );
			if ( array_intersect( $props, array( 'date_on_sale_from', 'date_on_sale_to', 'sale_price' ) ) ) {
				Silo_Sales::schedule_for( $product );
			}
		}
	}

	/**
	 * Title, description, slug, excerpt or menu order changed (post fields are not props).
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $after   Post after.
	 * @param WP_Post $before  Post before.
	 */
	public static function on_post_updated( $post_id, $after, $before ): void {
		if ( ! $after instanceof WP_Post || 'product' !== $after->post_type ) {
			return;
		}
		$changed = array();
		foreach ( array(
			'post_title'   => 'name',
			'post_content' => 'description',
			'post_excerpt' => 'short_description',
			'post_name'    => 'slug',
			'menu_order'   => 'menu_order',
		) as $field => $prop ) {
			if ( (string) $after->$field !== (string) $before->$field ) {
				$changed[] = $prop;
			}
		}
		if ( $changed ) {
			self::touch( (int) $post_id, 'content', $changed );
			if ( in_array( 'slug', $changed, true ) && 'publish' === $before->post_status && isset( self::$products[ (int) $post_id ] ) ) {
				self::$products[ (int) $post_id ]['old_urls'][] = (string) get_permalink( $before );
			}
		}
	}

	/**
	 * Publishing, unpublishing and scheduling change which archives list the product.
	 *
	 * @param string  $new_status New status.
	 * @param string  $old_status Old status.
	 * @param WP_Post $post       Post.
	 */
	public static function on_status_transition( $new_status, $old_status, $post ): void {
		if ( $new_status === $old_status || ! $post instanceof WP_Post || 'product' !== $post->post_type ) {
			return;
		}
		if ( 'publish' === $new_status || 'publish' === $old_status ) {
			self::touch( (int) $post->ID, 'publish' === $new_status ? 'published' : 'unpublished', array( 'status' ) );
		}
	}

	/**
	 * Catalog visibility changed (shop, search, hidden).
	 *
	 * @param int $product_id Product ID.
	 */
	public static function on_visibility( $product_id ): void {
		self::touch( (int) $product_id, 'visibility', array( 'catalog_visibility' ) );
	}

	/**
	 * Capture URLs before a product disappears; afterwards they cannot be resolved.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function on_before_remove( $post_id ): void {
		$post_id = (int) $post_id;
		if ( ! self::is_product_post( $post_id ) ) {
			return;
		}
		$product = wc_get_product( $post_id );
		if ( ! $product ) {
			return;
		}
		if ( $product->get_parent_id() > 0 ) {
			self::touch( $product, 'variations' );
			return;
		}
		if ( 'publish' !== get_post_status( $post_id ) && 'private' !== get_post_status( $post_id ) ) {
			return;
		}
		self::touch( $product, 'deleted' );
		self::$products[ $post_id ]['snapshot'] = self::describe( $product );
	}

	/**
	 * Hook callback: untrashed.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function on_untrashed( $post_id ): void {
		if ( 'product' === get_post_type( (int) $post_id ) ) {
			self::touch( (int) $post_id, 'published', array( 'status' ) );
		}
	}

	/**
	 * Hook callback: stock.
	 *
	 * @param WC_Product $product Product whose stock quantity was set.
	 */
	public static function on_stock( $product ): void {
		if ( $product instanceof WC_Product ) {
			self::touch( $product, 'stock', array( 'stock_quantity' ) );
		}
	}

	/**
	 * Hook callback: stock status.
	 *
	 * @param int        $id      Product ID.
	 * @param string     $status  New stock status.
	 * @param WC_Product $product Product.
	 */
	public static function on_stock_status( $id, $status, $product = null ): void {
		self::touch( $product instanceof WC_Product ? $product : (int) $id, 'stock', array( 'stock_status' ) );
	}

	/**
	 * Hook callback: order stock reduced.
	 *
	 * @param WC_Order $order Order.
	 */
	public static function on_order_stock_reduced( $order ): void {
		self::track_order( $order, 'order.stock_reduced' );
	}

	/**
	 * Hook callback: order stock restored.
	 *
	 * @param WC_Order $order Order.
	 */
	public static function on_order_stock_restored( $order ): void {
		self::track_order( $order, 'order.stock_restored' );
	}

	/**
	 * Hook callback: order refunded.
	 *
	 * @param int $order_id  Order ID.
	 * @param int $refund_id Refund ID.
	 */
	public static function on_order_refunded( $order_id, $refund_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( $order ) {
			self::track_order( $order, 'order.refunded', (int) $refund_id );
		}
	}

	/**
	 * Track order.
	 *
	 * @param WC_Order|mixed $order     Order.
	 * @param string         $type      Event type.
	 * @param int            $refund_id Refund ID.
	 */
	private static function track_order( $order, string $type, int $refund_id = 0 ): void {
		if ( ! $order instanceof WC_Order ) {
			return;
		}
		$roots = array();
		foreach ( $order->get_items() as $item ) {
			if ( $item instanceof WC_Order_Item_Product && $item->get_product_id() ) {
				$roots[ (int) $item->get_product_id() ] = array(
					'qty'          => (int) $item->get_quantity(),
					'variation_id' => (int) $item->get_variation_id(),
				);
			}
		}
		self::$orders[ $order->get_id() ] = array(
			'type'      => $type,
			'number'    => $order->get_order_number(),
			'status'    => $order->get_status(),
			'refund_id' => $refund_id,
			'items'     => $roots,
		);
		self::register_flush();
	}

	/**
	 * Category, tag, brand or attribute assignment changed on a product.
	 *
	 * @param int    $object_id  Object ID.
	 * @param array  $terms      Terms.
	 * @param array  $tt_ids     New term taxonomy IDs.
	 * @param string $taxonomy   Taxonomy.
	 * @param bool   $append     Append mode.
	 * @param array  $old_tt_ids Previous term taxonomy IDs.
	 */
	public static function on_object_terms( $object_id, $terms, $tt_ids, $taxonomy, $append, $old_tt_ids ): void {
		if ( ! self::is_product_taxonomy( (string) $taxonomy ) || 'product' !== get_post_type( (int) $object_id ) ) {
			return;
		}
		$new = array_map( 'intval', (array) $tt_ids );
		$old = array_map( 'intval', (array) $old_tt_ids );
		sort( $new );
		sort( $old );
		if ( $new === $old ) {
			return;
		}
		self::touch( (int) $object_id, 'terms', array( $taxonomy ) );
		foreach ( array_diff( $old, $new ) as $tt_id ) {
			$term = get_term_by( 'term_taxonomy_id', $tt_id );
			if ( $term instanceof WP_Term ) {
				$link = get_term_link( $term );
				if ( is_string( $link ) ) {
					self::$products[ (int) $object_id ]['old_terms'][] = $link;
				}
			}
		}
	}

	/**
	 * Whether product taxonomy.
	 *
	 * @param string $taxonomy Taxonomy.
	 */
	private static function is_product_taxonomy( string $taxonomy ): bool {
		return in_array( $taxonomy, array( 'product_cat', 'product_tag', 'product_brand' ), true ) || str_starts_with( $taxonomy, 'pa_' );
	}

	/**
	 * Capture term link.
	 *
	 * @param int    $term_id  Term ID.
	 * @param int    $tt_id    Term taxonomy ID.
	 * @param string $taxonomy Taxonomy.
	 */
	public static function capture_term_link( $term_id, $tt_id, $taxonomy ): void {
		if ( self::is_product_taxonomy( (string) $taxonomy ) ) {
			$link = get_term_link( (int) $term_id, (string) $taxonomy );
			if ( is_string( $link ) ) {
				self::$term_links[ (int) $term_id ] = $link;
			}
		}
	}

	/**
	 * Capture term link delete.
	 *
	 * @param int    $term_id  Term ID.
	 * @param string $taxonomy Taxonomy.
	 */
	public static function capture_term_link_delete( $term_id, $taxonomy ): void {
		self::capture_term_link( $term_id, 0, $taxonomy );
	}

	/**
	 * Hook callback: term edited.
	 *
	 * @param int    $term_id  Term ID.
	 * @param int    $tt_id    Term taxonomy ID.
	 * @param string $taxonomy Taxonomy.
	 */
	public static function on_term_edited( $term_id, $tt_id, $taxonomy ): void {
		if ( self::is_product_taxonomy( (string) $taxonomy ) ) {
			self::track_term( (int) $term_id, (string) $taxonomy, 'term.updated' );
		}
	}

	/**
	 * Hook callback: term deleted.
	 *
	 * @param int     $term_id      Term ID.
	 * @param int     $tt_id        Term taxonomy ID.
	 * @param string  $taxonomy     Taxonomy.
	 * @param WP_Term $deleted_term Deleted term.
	 */
	public static function on_term_deleted( $term_id, $tt_id, $taxonomy, $deleted_term = null ): void {
		if ( self::is_product_taxonomy( (string) $taxonomy ) ) {
			self::track_term( (int) $term_id, (string) $taxonomy, 'term.deleted', $deleted_term instanceof WP_Term ? $deleted_term : null );
		}
	}

	/**
	 * A new child category appears on its parent's archive.
	 *
	 * @param int    $term_id  Term ID.
	 * @param int    $tt_id    Term taxonomy ID.
	 * @param string $taxonomy Taxonomy.
	 */
	public static function on_term_created( $term_id, $tt_id, $taxonomy ): void {
		if ( 'product_cat' !== $taxonomy ) {
			return;
		}
		$term = get_term( (int) $term_id, 'product_cat' );
		if ( $term instanceof WP_Term && $term->parent > 0 ) {
			self::track_term( (int) $term->parent, 'product_cat', 'term.updated' );
		}
	}

	/**
	 * Track term.
	 *
	 * @param int          $term_id Term ID.
	 * @param string       $taxonomy Taxonomy.
	 * @param string       $type Type.
	 * @param WP_Term|null $snapshot Snapshot.
	 */
	private static function track_term( int $term_id, string $taxonomy, string $type, ?WP_Term $snapshot = null ): void {
		$term = $snapshot ?? get_term( $term_id, $taxonomy );
		if ( ! $term instanceof WP_Term ) {
			return;
		}
		$links = array();
		if ( isset( self::$term_links[ $term_id ] ) ) {
			$links[] = self::$term_links[ $term_id ];
		}
		if ( 'term.deleted' !== $type ) {
			$link = get_term_link( $term );
			if ( is_string( $link ) ) {
				$links[] = $link;
			}
		}
		foreach ( get_ancestors( $term_id, $taxonomy, 'taxonomy' ) as $ancestor ) {
			$link = get_term_link( (int) $ancestor, $taxonomy );
			if ( is_string( $link ) ) {
				$links[] = $link;
			}
		}

		self::$terms[ $term_id ] = array(
			'type'     => $type,
			'taxonomy' => $taxonomy,
			'name'     => $term->name,
			'count'    => (int) $term->count,
			'links'    => array_values( array_unique( $links ) ),
		);
		self::register_flush();
	}

	/**
	 * Hook callback: comment post.
	 *
	 * @param int        $comment_id Comment ID.
	 * @param int|string $approved   Approval state.
	 */
	public static function on_comment_post( $comment_id, $approved ): void {
		$comment = get_comment( (int) $comment_id );
		if ( 1 === (int) $approved && $comment && 'product' === get_post_type( (int) $comment->comment_post_ID ) ) {
			self::touch( (int) $comment->comment_post_ID, 'review' );
		}
	}

	/**
	 * Hook callback: comment status.
	 *
	 * @param string     $new_status New status.
	 * @param string     $old_status Old status.
	 * @param WP_Comment $comment    Comment.
	 */
	public static function on_comment_status( $new_status, $old_status, $comment ): void {
		if ( $comment instanceof WP_Comment && ( 'approved' === $new_status || 'approved' === $old_status ) && 'product' === get_post_type( (int) $comment->comment_post_ID ) ) {
			self::touch( (int) $comment->comment_post_ID, 'review' );
		}
	}

	/**
	 * Hook callback: option.
	 *
	 * @param string $option Option name.
	 * @param mixed  $old    Old value.
	 * @param mixed  $value  New value.
	 */
	public static function on_option( $option, $old, $value ): void {
		if ( $old === $value ) {
			return;
		}
		if ( 'sidebars_widgets' === $option || str_starts_with( (string) $option, 'widget_' ) ) {
			self::on_layout_change();
			return;
		}
		if ( in_array( $option, self::WATCHED_OPTIONS, true ) ) {
			self::$global['system.settings'] = array(
				'reason' => 'WooCommerce setting changed',
				'detail' => (string) $option,
			);
			self::register_flush();
		}
	}

	/**
	 * Menus and widgets render on every cached page (header, footer, sidebars).
	 */
	public static function on_layout_change(): void {
		self::$global['system.theme'] = array(
			'reason' => 'Menu or widget change',
			'detail' => 'header, footer and sidebars appear on every cached page',
		);
		self::register_flush();
	}

	/**
	 * Block-theme templates, global styles and page-builder templates shape product and archive pages.
	 *
	 * @param int     $post_id Post ID.
	 * @param WP_Post $post    Post.
	 */
	public static function on_template_saved( $post_id, $post ): void {
		if ( ! $post instanceof WP_Post || wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
			return;
		}
		if ( in_array( $post->post_type, self::layout_post_types(), true ) ) {
			self::$global['system.theme'] = array(
				'reason' => 'Template change',
				'detail' => $post->post_type . ': ' . $post->post_title,
			);
			self::register_flush();
		}
	}

	/**
	 * Post types that hold headers, footers and templates shown across the store: block themes,
	 * page builders (Elementor, Beaver Builder, Divi, Bricks, Oxygen, Breakdance) and theme
	 * layout systems (Astra, Kadence, GeneratePress, Blocksy, Flatsome).
	 */
	public static function layout_post_types(): array {
		$types = array(
			'wp_template',
			'wp_template_part',
			'wp_global_styles',
			'wp_navigation',
			'elementor_library',
			'fl-builder-template',
			'fl-theme-layout',
			'et_template',
			'et_theme_builder',
			'et_header_layout',
			'et_body_layout',
			'et_footer_layout',
			'bricks_template',
			'ct_template',
			'breakdance_template',
			'breakdance_header',
			'breakdance_footer',
			'breakdance_block',
			'astra-advanced-hook',
			'kadence_element',
			'gp_elements',
			'ct_content_block',
			'blocks',
		);
		/**
		 * Filters the post types whose changes clear every cached page.
		 *
		 * @param string[] $types Post types.
		 */
		return (array) apply_filters( 'silo_layout_post_types', $types );
	}

	/**
	 * A store-wide layout change from outside this class (builders, compat hooks).
	 *
	 * @param string $reason Reason shown in the log.
	 * @param string $detail Detail.
	 */
	public static function global_change( string $reason, string $detail ): void {
		self::$global['system.theme'] = array(
			'reason' => $reason,
			'detail' => $detail,
		);
		self::register_flush();
	}

	/**
	 * Elementor stores product layouts in meta, so post_updated never sees the change.
	 *
	 * @param int $post_id Post ID.
	 */
	public static function on_builder_saved( $post_id ): void {
		if ( 'product' === get_post_type( (int) $post_id ) ) {
			self::touch( (int) $post_id, 'content', array( 'layout' ) );
		}
	}

	/**
	 * A sale started or ended (scheduled by Silo_Sales at the exact moment).
	 *
	 * @param int    $product_id Product ID.
	 * @param string $kind       start | end | end_safety.
	 */
	public static function sale_boundary( int $product_id, string $kind ): void {
		$product = wc_get_product( $product_id );
		if ( ! $product ) {
			return;
		}
		if ( 'end_safety' === $kind ) {
			// Safety pass after cron jitter: purge on-site only, no new event.
			$description = self::describe( $product );
			Silo_Page_Cache::purge_urls( self::flatten_urls( $description ) );
			Silo_Store_API_Cache::purge( 'collections', array( $product_id ) );
			return;
		}
		self::touch( $product, 'sale', array( 'sale_price', 'price' ) );
	}

	/**
	 * Hook callback: theme change.
	 */
	public static function on_theme_change(): void {
		self::$global['system.theme'] = array(
			'reason' => 'Theme or Customizer change',
			'detail' => (string) get_stylesheet(),
		);
		self::register_flush();
	}

	/**
	 * Hook callback: upgrade.
	 *
	 * @param WP_Upgrader $upgrader Upgrader.
	 * @param array       $extra    Details.
	 */
	public static function on_upgrade( $upgrader, $extra ): void {
		$type = (string) ( $extra['type'] ?? '' );
		if ( in_array( $type, array( 'plugin', 'theme', 'core' ), true ) ) {
			self::$global['system.upgrade'] = array(
				'reason' => ucfirst( $type ) . ' update',
				'detail' => $type,
			);
			self::register_flush();
		}
	}

	// Consolidation and local invalidation.

	/**
	 * End of request: consolidate, purge locally, persist, schedule dispatch.
	 */
	public static function flush(): void {
		$products = self::$products;
		$orders   = self::$orders;
		$terms    = self::$terms;
		$global   = self::$global;

		self::$products = array();
		self::$orders   = array();
		self::$terms    = array();
		self::$global   = array();

		if ( $global ) {
			self::flush_global( $global );
			return; // A full purge covers every product and term change in this request.
		}

		$events = array();

		foreach ( $orders as $order_id => $order ) {
			$items = array();
			foreach ( $order['items'] as $root => $item ) {
				if ( ! isset( $products[ $root ] ) ) {
					continue; // Unmanaged stock: nothing in the catalog moved.
				}
				$description = self::describe_entry( (int) $root, $products[ $root ] );
				unset( $products[ $root ] );
				if ( $description ) {
					$description['qty'] = $item['qty'];
					$items[]            = $description;
				}
			}
			if ( ! $items ) {
				continue;
			}
			$events[] = self::order_event( (int) $order_id, $order, $items );
		}

		foreach ( $products as $root => $entry ) {
			$description = self::describe_entry( (int) $root, $entry );
			if ( $description ) {
				$events[] = self::product_event( $description, $entry );
			}
		}

		foreach ( $terms as $term_id => $term ) {
			$events[] = self::term_event( (int) $term_id, $term );
		}

		if ( ! $events ) {
			return;
		}

		foreach ( $events as $event ) {
			$started = microtime( true );
			$pages   = Silo_Page_Cache::purge_urls( $event['urls'] );
			$api     = Silo_Store_API_Cache::purge( $event['payload']['store_api']['mode'], $event['payload']['store_api']['product_ids'] );

			Silo_Log::insert(
				array(
					'type'     => $event['type'],
					'object'   => $event['object'],
					'detail'   => $event['detail'],
					'state'    => 'queued',
					'purged'   => $pages['urls'],
					'local_ms' => (int) round( ( microtime( true ) - $started ) * 1000 ),
					'payload'  => $event['payload'],
					'scope'    => array(
						'local' => array_values( array_unique( $event['urls'] ) ),
						'pages' => $pages['pages'],
						'api'   => $api,
					),
				)
			);
		}

		self::schedule_dispatch();
	}

	/**
	 * Purge everything for store-wide changes and log each cause.
	 *
	 * @param array $changes Change type => reason and detail.
	 */
	private static function flush_global( array $changes ): void {
		$started = microtime( true );
		$count   = Silo_Page_Cache::purge_everything( false );
		foreach ( $changes as $type => $info ) {
			Silo_Log::insert(
				array(
					'type'     => $type,
					'object'   => $info['reason'],
					'detail'   => $info['detail'],
					'state'    => 'queued',
					'purged'   => $count,
					'local_ms' => (int) round( ( microtime( true ) - $started ) * 1000 ),
					'payload'  => array(
						'reason'    => $info['reason'],
						'detail'    => $info['detail'],
						'urls'      => array(),
						'store_api' => array(
							'mode'        => 'all',
							'product_ids' => array(),
						),
					),
					'scope'    => array(
						'local' => array(),
						'all'   => true,
						'pages' => $count,
					),
				)
			);
		}
		self::schedule_dispatch();
	}

	/**
	 * Full picture of a changed product (or the snapshot captured before deletion).
	 *
	 * @param int   $root Root.
	 * @param array $entry Entry.
	 */
	private static function describe_entry( int $root, array $entry ): ?array {
		if ( ! empty( $entry['snapshot'] ) ) {
			return $entry['snapshot'];
		}
		$product = wc_get_product( $root );
		if ( ! $product ) {
			return null;
		}
		$description = self::describe( $product, array_keys( $entry['variations'] ) );
		if ( ! empty( $entry['old_terms'] ) ) {
			$description['urls']['previous'] = array_merge( $description['urls']['previous'], $entry['old_terms'] );
		}
		if ( ! empty( $entry['old_urls'] ) ) {
			$description['urls']['previous'] = array_merge( $description['urls']['previous'], $entry['old_urls'] );
		}
		return $description;
	}

	/**
	 * Every URL and node that depends on a product.
	 *
	 * @param WC_Product $product       Product (parent level).
	 * @param int[]      $variation_ids Variations that changed.
	 */
	public static function describe( WC_Product $product, array $variation_ids = array() ): array {
		$id         = $product->get_id();
		$variations = array();

		foreach ( array_slice( $variation_ids, 0, 25 ) as $variation_id ) {
			$variation = wc_get_product( $variation_id );
			if ( $variation instanceof WC_Product_Variation ) {
				$variations[] = array(
					'id'             => $variation_id,
					'label'          => str_replace( ', ', ' / ', wc_get_formatted_variation( $variation, true, false, false ) ),
					'sku'            => $variation->get_sku(),
					'stock_status'   => $variation->get_stock_status(),
					'stock_quantity' => $variation->get_stock_quantity(),
					'price'          => $variation->get_price(),
				);
			}
		}

		$urls = array(
			'product'         => 'publish' === $product->get_status() || 'private' === $product->get_status() ? (string) get_permalink( $id ) : '',
			'categories'      => self::term_urls( $id, 'product_cat', true ),
			'tags'            => self::term_urls( $id, 'product_tag' ),
			'brands'          => taxonomy_exists( 'product_brand' ) ? self::term_urls( $id, 'product_brand' ) : array(),
			'attributes'      => self::attribute_urls( $product ),
			'grouped_parents' => self::grouped_parents( $id ),
			'shop'            => function_exists( 'wc_get_page_permalink' ) ? (string) wc_get_page_permalink( 'shop' ) : '',
			'home'            => Silo_Settings::get( 'cache_front_page' ) ? home_url( '/' ) : '',
			'previous'        => array(),
		);

		return array(
			'product_id'     => $id,
			'name'           => $product->get_name(),
			'sku'            => $product->get_sku(),
			'product_type'   => $product->get_type(),
			'status'         => $product->get_status(),
			'stock_status'   => $product->get_stock_status(),
			'stock_quantity' => $product->get_stock_quantity(),
			'price'          => $product->get_price(),
			'variations'     => $variations,
			'urls'           => $urls,
		);
	}

	/**
	 * Term URLs.
	 *
	 * @param int    $product_id Product ID.
	 * @param string $taxonomy Taxonomy.
	 * @param bool   $with_ancestors With ancestors.
	 */
	private static function term_urls( int $product_id, string $taxonomy, bool $with_ancestors = false ): array {
		$terms = get_the_terms( $product_id, $taxonomy );
		if ( ! is_array( $terms ) ) {
			return array();
		}
		$urls = array();
		foreach ( $terms as $term ) {
			$link = get_term_link( $term );
			if ( is_string( $link ) ) {
				$urls[] = $link;
			}
			if ( $with_ancestors ) {
				foreach ( get_ancestors( $term->term_id, $taxonomy, 'taxonomy' ) as $ancestor ) {
					$ancestor_link = get_term_link( (int) $ancestor, $taxonomy );
					if ( is_string( $ancestor_link ) ) {
						$urls[] = $ancestor_link;
					}
				}
			}
		}
		return array_values( array_unique( $urls ) );
	}

	/**
	 * Archive pages of public attribute taxonomies (pa_*) the product belongs to.
	 *
	 * @param WC_Product $product Product.
	 */
	private static function attribute_urls( WC_Product $product ): array {
		$urls = array();
		foreach ( $product->get_attributes() as $attribute ) {
			if ( ! $attribute instanceof WC_Product_Attribute || ! $attribute->is_taxonomy() ) {
				continue;
			}
			$taxonomy = $attribute->get_name();
			$object   = get_taxonomy( $taxonomy );
			if ( ! $object || ! $object->public ) {
				continue;
			}
			$terms = $attribute->get_terms();
			foreach ( is_array( $terms ) ? $terms : array() as $term ) {
				$link = get_term_link( $term );
				if ( is_string( $link ) ) {
					$urls[] = $link;
				}
			}
		}
		return array_values( array_unique( $urls ) );
	}

	/**
	 * Grouped products list their children with live price and stock.
	 *
	 * @param int $product_id Product ID.
	 */
	private static function grouped_parents( int $product_id ): array {
		global $wpdb;
		$ids  = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT pm.post_id FROM {$wpdb->postmeta} pm INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id AND p.post_status = 'publish' WHERE pm.meta_key = '_children' AND ( pm.meta_value LIKE %s OR pm.meta_value LIKE %s ) LIMIT 20",
				'%i:' . $product_id . ';%',
				'%"' . $product_id . '"%'
			)
		);
		$urls = array();
		foreach ( (array) $ids as $parent ) {
			$urls[] = (string) get_permalink( (int) $parent );
		}
		return array_values( array_filter( $urls ) );
	}

	/**
	 * Flat list of every URL in a description.
	 *
	 * @param array $description Description.
	 */
	private static function flatten_urls( array $description ): array {
		$urls = array();
		foreach ( (array) ( $description['urls'] ?? array() ) as $value ) {
			foreach ( (array) $value as $url ) {
				if ( is_string( $url ) && '' !== $url ) {
					$urls[] = $url;
				}
			}
		}
		return array_values( array_unique( $urls ) );
	}

	/**
	 * Product event.
	 *
	 * @param array $description Description.
	 * @param array $entry Entry.
	 */
	private static function product_event( array $description, array $entry ): array {
		$reasons = array_keys( $entry['reasons'] );
		$props   = $entry['props'];

		if ( in_array( 'deleted', $reasons, true ) ) {
			$type = 'product.deleted';
		} elseif ( in_array( 'created', $reasons, true ) ) {
			$type = 'product.created';
		} elseif ( in_array( 'stock', $reasons, true ) || array_intersect( $props, self::STOCK_PROPS ) ) {
			$type = 'stock.changed';
		} elseif ( array_intersect( $props, self::PRICE_PROPS ) ) {
			$type = 'scheduled_sale' === $entry['context'] ? 'sale.boundary' : 'price.updated';
		} elseif ( array_intersect( $reasons, array( 'published', 'unpublished', 'visibility' ) ) || array_intersect( $props, self::VISIBILITY_PROPS ) ) {
			$type = 'product.visibility';
		} elseif ( array( 'review' ) === $reasons ) {
			$type = 'review.updated';
		} else {
			$type = 'product.updated';
		}

		$membership_changes = in_array( $type, array( 'product.deleted', 'product.created', 'stock.changed', 'price.updated', 'sale.boundary', 'product.visibility' ), true ) || in_array( 'terms', $reasons, true );
		$variation_ids      = wp_list_pluck( $description['variations'], 'id' );

		$description['event_reasons'] = $reasons;
		$description['props']         = $props;
		$description['context']       = $entry['context'];
		$description['store_api']     = array(
			'mode'        => $membership_changes ? 'collections' : 'products',
			'product_ids' => array_values( array_map( 'intval', array_merge( array( $description['product_id'] ), $variation_ids ) ) ),
		);

		$urls = self::flatten_urls( $description );
		if ( 'review.updated' === $type || ( 'product.updated' === $type && ! $membership_changes ) ) {
			// Content-only edits: the product page and its grouped parents, not every archive.
			$urls = array_values( array_filter( array_merge( array( $description['urls']['product'] ), $description['urls']['grouped_parents'], $description['urls']['previous'] ) ) );
		}

		return array(
			'type'    => $type,
			'object'  => $description['name'],
			'detail'  => self::detail_line( $description ),
			'urls'    => $urls,
			'payload' => $description,
		);
	}

	/**
	 * Order event.
	 *
	 * @param int   $order_id Order ID.
	 * @param array $order Order.
	 * @param array $items Items.
	 */
	private static function order_event( int $order_id, array $order, array $items ): array {
		$ids = array();
		foreach ( $items as $item ) {
			$ids[] = (int) $item['product_id'];
			foreach ( $item['variations'] as $variation ) {
				$ids[] = (int) $variation['id'];
			}
		}
		$urls = array();
		foreach ( $items as $item ) {
			$urls = array_merge( $urls, self::flatten_urls( $item ) );
		}

		$names = wp_list_pluck( $items, 'name' );

		return array(
			'type'    => $order['type'],
			'object'  => 1 === count( $names ) ? (string) $names[0] : sprintf( '%s + %d more', $names[0], count( $names ) - 1 ),
			/* translators: 1: order number, 2: product count */
			'detail'  => sprintf( __( 'order #%1$s · %2$d products', 'silo-connector' ), $order['number'], count( $items ) ),
			'urls'    => array_values( array_unique( $urls ) ),
			'payload' => array(
				'order_id'     => $order_id,
				'order_number' => $order['number'],
				'order_status' => $order['status'],
				'refund_id'    => $order['refund_id'],
				'items'        => $items,
				'store_api'    => array(
					'mode'        => 'collections',
					'product_ids' => array_values( array_unique( $ids ) ),
				),
			),
		);
	}

	/**
	 * Term event.
	 *
	 * @param int   $term_id Term ID.
	 * @param array $term Term.
	 */
	private static function term_event( int $term_id, array $term ): array {
		$labels = array(
			'product_cat'   => 'category',
			'product_tag'   => 'tag',
			'product_brand' => 'brand',
		);
		$label  = $labels[ $term['taxonomy'] ] ?? 'attribute';

		return array(
			'type'    => $term['type'],
			'object'  => $term['name'],
			/* translators: 1: term kind, 2: number of products */
			'detail'  => sprintf( __( '%1$s · %2$d products', 'silo-connector' ), $label, $term['count'] ),
			'urls'    => $term['links'],
			'payload' => array(
				'term_id'   => $term_id,
				'taxonomy'  => $term['taxonomy'],
				'kind'      => $label,
				'name'      => $term['name'],
				'count'     => $term['count'],
				'urls'      => array( 'terms' => $term['links'] ),
				'store_api' => array(
					'mode'        => 'collections',
					'product_ids' => array(),
				),
			),
		);
	}

	/**
	 * Detail line.
	 *
	 * @param array $description Description.
	 */
	private static function detail_line( array $description ): string {
		$parts = array();
		if ( ! empty( $description['variations'] ) ) {
			$first   = $description['variations'][0];
			$parts[] = strtolower( (string) $first['label'] );
			if ( count( $description['variations'] ) > 1 ) {
				$parts[] = '+' . ( count( $description['variations'] ) - 1 ) . ' variations';
			}
			if ( ! empty( $first['sku'] ) ) {
				$parts[] = $first['sku'];
			}
		} elseif ( ! empty( $description['sku'] ) ) {
			$parts[] = $description['sku'];
		}
		if ( ! $parts ) {
			$parts[] = (string) $description['product_type'];
		}
		return implode( ' · ', $parts );
	}

	// Dispatch to Silo.

	/**
	 * Schedule dispatch.
	 *
	 * @param int $delay Delay.
	 */
	public static function schedule_dispatch( int $delay = 0 ): void {
		if ( function_exists( 'as_enqueue_async_action' ) ) {
			if ( ! as_has_scheduled_action( self::DISPATCH_HOOK, array(), 'silo' ) ) {
				if ( $delay > 0 ) {
					as_schedule_single_action( time() + $delay, self::DISPATCH_HOOK, array(), 'silo' );
				} else {
					as_enqueue_async_action( self::DISPATCH_HOOK, array(), 'silo' );
				}
			}
			return;
		}
		if ( ! wp_next_scheduled( self::DISPATCH_HOOK ) ) {
			wp_schedule_single_event( time() + $delay, self::DISPATCH_HOOK );
		}
	}

	/**
	 * Called by heartbeat and admin polling so events never sit if async runners are blocked.
	 */
	public static function maybe_kick(): void {
		if ( Silo_Log::count_state( 'queued' ) > 0 && Silo_Log::oldest_queued_age() > 15 ) {
			self::dispatch();
		}
	}

	/**
	 * Send queued events to Silo in one batch and apply what comes back.
	 */
	public static function dispatch(): void {
		if ( ! Silo_Settings::is_connected() || get_transient( 'silo_dispatch_lock' ) ) {
			return;
		}
		set_transient( 'silo_dispatch_lock', 1, 60 );

		try {
			$rows = Silo_Log::queued( 25 );
			if ( ! $rows ) {
				return;
			}

			$events = array();
			foreach ( $rows as $row ) {
				$scope    = json_decode( (string) $row->scope, true );
				$events[] = array(
					'ref'          => $row->ref,
					'type'         => $row->type,
					'object'       => $row->object,
					'detail'       => $row->detail,
					'payload'      => json_decode( (string) $row->payload, true ),
					'occurred_at'  => mysql_to_rfc3339( (string) $row->created_at ),
					'local_purged' => count( (array) ( $scope['local'] ?? array() ) ),
					'local_ms'     => (int) $row->local_ms,
				);
			}

			$response = Silo_Api::post( '/api/events', array( 'events' => $events ), 25 );

			if ( is_wp_error( $response ) || $response['code'] >= 500 || 0 === $response['code'] ) {
				foreach ( $rows as $row ) {
					$attempts = (int) $row->attempts + 1;
					Silo_Log::update(
						(int) $row->id,
						array(
							'attempts' => $attempts,
							'state'    => $attempts >= 6 ? 'local' : 'queued',
						)
					);
				}
				update_option( 'silo_hb_error', Silo_Api::error_message( $response ), false );
				self::schedule_dispatch( 60 );
				return;
			}

			if ( 401 === $response['code'] || 403 === $response['code'] ) {
				Silo_Settings::record_plan( $response );
				Silo_Settings::set_auth_error( Silo_Api::error_message( $response ) );
				foreach ( $rows as $row ) {
					Silo_Log::update( (int) $row->id, array( 'state' => 'failed' ) );
				}
				return;
			}

			if ( 429 === $response['code'] ) {
				foreach ( $rows as $row ) {
					Silo_Log::update( (int) $row->id, array( 'state' => 'limited' ) );
				}
				return;
			}

			Silo_Settings::set_auth_error( '' );
			$results = array();
			foreach ( (array) ( $response['body']['results'] ?? array() ) as $result ) {
				if ( isset( $result['ref'] ) ) {
					$results[ (string) $result['ref'] ] = $result;
				}
			}

			foreach ( $rows as $row ) {
				self::apply_result( $row, $results[ $row->ref ] ?? null );
			}
		} finally {
			delete_transient( 'silo_dispatch_lock' );
		}

		if ( Silo_Log::count_state( 'queued' ) > 0 ) {
			self::schedule_dispatch();
		}
	}

	/**
	 * Apply Silo's resolution for one event: extra purges, Store API scope, warmup.
	 *
	 * @param object     $row    Log row.
	 * @param array|null $result Silo result.
	 */
	private static function apply_result( $row, ?array $result ): void {
		if ( null === $result ) {
			Silo_Log::update( (int) $row->id, array( 'state' => 'failed' ) );
			return;
		}
		if ( ! empty( $result['error'] ) ) {
			Silo_Log::update(
				(int) $row->id,
				array(
					'state'         => 'EVENT_LIMIT' === ( $result['code'] ?? '' ) ? 'limited' : 'failed',
					'saas_event_id' => (string) ( $result['event_id'] ?? '' ),
				)
			);
			return;
		}

		$scope = json_decode( (string) $row->scope, true );
		$scope = is_array( $scope ) ? $scope : array();
		$local = (array) ( $scope['local'] ?? array() );
		$purge = array_values( array_filter( (array) ( $result['purge'] ?? array() ), 'is_string' ) );
		$extra = array_values( array_diff( $purge, $local ) );
		if ( $extra && empty( $scope['all'] ) ) {
			Silo_Page_Cache::purge_urls( $extra );
		}

		$api_mode = (string) ( $result['store_api']['mode'] ?? '' );
		if ( 'all' === $api_mode && empty( $scope['all'] ) ) {
			Silo_Store_API_Cache::purge( 'all' );
		}

		$warm   = array_values( array_filter( (array) ( $result['warm'] ?? array() ), 'is_string' ) );
		$job_id = (string) ( $result['warmup_job_id'] ?? '' );
		$queued = ( $warm && '' !== $job_id ) ? Silo_Warmup::enqueue( $warm, $job_id, 'event' ) : 0;

		$scope['resolved'] = $purge;
		$scope['warm']     = $warm;

		Silo_Log::update(
			(int) $row->id,
			array(
				'state'         => $queued > 0 ? 'warming' : 'purged',
				'saas_event_id' => substr( (string) ( $result['event_id'] ?? '' ), 0, 40 ),
				'warm_job_id'   => substr( $job_id, 0, 40 ),
				'duration_ms'   => (int) ( $result['duration_ms'] ?? 0 ),
				'purged'        => count( array_unique( array_merge( $local, $purge ) ) ),
				'warm_total'    => count( $warm ),
				'scope'         => $scope,
			)
		);
	}

	/**
	 * Record a site-wide purge requested from either dashboard.
	 *
	 * @param string $origin 'admin' or 'silo'.
	 * @param int    $pages Pages.
	 * @param bool   $send Send.
	 */
	public static function log_purge_all( string $origin, int $pages, bool $send ): void {
		Silo_Log::insert(
			array(
				'type'    => 'purge.all',
				'object'  => 'admin' === $origin ? __( 'Purged from WordPress', 'silo-connector' ) : __( 'Purged from Silo dashboard', 'silo-connector' ),
				/* translators: %d: pages removed */
				'detail'  => sprintf( __( '%d cached entries removed · stats reset', 'silo-connector' ), $pages ),
				'state'   => $send ? 'queued' : 'done',
				'purged'  => $pages,
				'payload' => array(
					'origin'    => $origin,
					'pages'     => $pages,
					'urls'      => array(),
					'store_api' => array(
						'mode'        => 'all',
						'product_ids' => array(),
					),
				),
				'scope'   => array(
					'local' => array(),
					'all'   => true,
					'pages' => $pages,
				),
			)
		);
		if ( $send ) {
			self::schedule_dispatch();
		}
	}
}
