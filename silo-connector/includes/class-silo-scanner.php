<?php
/**
 * Catalog scan. Builds the graph Silo uses to plan invalidation: products and their
 * types, variations, stock, categories/tags/brands/attributes, archives, Store API
 * routes and warmup priority. Nothing is fetched or cached while scanning.
 *
 * The scan is a resumable state machine: the WordPress admin drives it step by step
 * (so progress is real and animated), and Action Scheduler drives it when the scan is
 * started from the Silo dashboard. Every step reports progress to Silo.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared

/**
 * Catalog scanner.
 */
class Silo_Scanner {

	const OPTION = 'silo_scan';
	const HOOK   = 'silo_scan_run';
	const BATCH  = 400;
	const STAGES = array(
		'environment' => array(
			'label'  => 'Reading store environment',
			'from'   => 0,
			'weight' => 6,
		),
		'catalog'     => array(
			'label'  => 'Mapping products and variations',
			'from'   => 6,
			'weight' => 56,
		),
		'taxonomies'  => array(
			'label'  => 'Resolving archives',
			'from'   => 62,
			'weight' => 14,
		),
		'store_api'   => array(
			'label'  => 'Mapping Store API routes',
			'from'   => 76,
			'weight' => 8,
		),
		'priority'    => array(
			'label'  => 'Scoring warmup priority',
			'from'   => 84,
			'weight' => 6,
		),
		'sync'        => array(
			'label'  => 'Generating cache profile',
			'from'   => 90,
			'weight' => 10,
		),
	);

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'run_background' ) );
	}

	/**
	 * State.
	 */
	public static function state(): array {
		$state = get_option( self::OPTION, array() );
		return is_array( $state ) ? $state : array();
	}

	/**
	 * Reset.
	 */
	public static function reset(): void {
		delete_option( self::OPTION );
	}

	/**
	 * Whether running.
	 */
	public static function is_running(): bool {
		$state = self::state();
		return 'running' === ( $state['status'] ?? '' );
	}

	/**
	 * Start a fresh scan.
	 *
	 * @param string $origin 'admin', 'silo' or 'activation'.
	 */
	public static function start( string $origin ): array {
		global $wpdb;
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish'" );

		$state = array(
			'id'              => Silo_Log::ref(),
			'status'          => 'running',
			'origin'          => $origin,
			'stage'           => 'environment',
			'percent'         => 0,
			'started_at'      => time(),
			'finished_at'     => 0,
			'error'           => '',
			'cursor'          => 0,
			'total'           => $total,
			'counts'          => array(
				'products'   => 0,
				'variations' => 0,
				'archives'   => 0,
				'routes'     => 0,
				'priority'   => 0,
				'edges'      => 0,
				'nodes'      => 0,
			),
			'types'           => array(),
			'stock'           => array(
				'managed'     => 0,
				'instock'     => 0,
				'outofstock'  => 0,
				'onbackorder' => 0,
			),
			'variation_stock' => array(
				'instock'     => 0,
				'outofstock'  => 0,
				'onbackorder' => 0,
			),
			'taxonomies'      => array(),
			'env'             => array(),
			'routes'          => array(),
			'priority'        => array(),
			'bestsellers'     => array(),
			'log'             => array(),
			'result'          => array(),
		);
		self::log( $state, sprintf( 'Scan started · %s published products', number_format_i18n( $total ) ) );
		update_option( self::OPTION, $state, false );
		self::report( $state );
		return $state;
	}

	/**
	 * Run one bounded unit of work and persist progress.
	 */
	public static function step(): array {
		$state = self::state();
		if ( 'running' !== ( $state['status'] ?? '' ) || get_transient( 'silo_scan_lock' ) ) {
			return $state;
		}
		set_transient( 'silo_scan_lock', 1, 30 );

		$budget = microtime( true ) + 2.5;
		try {
			do {
				$stage = $state['stage'];
				switch ( $stage ) {
					case 'environment':
						self::stage_environment( $state );
						break;
					case 'catalog':
						self::stage_catalog( $state );
						break;
					case 'taxonomies':
						self::stage_taxonomies( $state );
						break;
					case 'store_api':
						self::stage_store_api( $state );
						break;
					case 'priority':
						self::stage_priority( $state );
						break;
					case 'sync':
						self::stage_sync( $state );
						break;
					default:
						$state['status'] = 'failed';
						$state['error']  = 'Unknown scan stage.';
				}
			} while ( 'running' === $state['status'] && 'catalog' === $state['stage'] && 'catalog' === $stage && microtime( true ) < $budget );
		} catch ( Throwable $error ) {
			$state['status'] = 'failed';
			$state['error']  = $error->getMessage();
			self::log( $state, 'Scan failed: ' . $error->getMessage() );
		} finally {
			delete_transient( 'silo_scan_lock' );
		}

		if ( 'running' !== $state['status'] ) {
			$state['finished_at'] = time();
		}
		$state['counts']['nodes'] = (int) $state['counts']['products'] + (int) $state['counts']['variations'] + (int) $state['counts']['archives'] + (int) $state['counts']['routes'];

		update_option( self::OPTION, $state, false );
		self::report( $state );
		return $state;
	}

	/**
	 * Background driver for scans started by Silo.
	 */
	public static function run_background(): void {
		$deadline = microtime( true ) + 20;
		while ( self::is_running() && microtime( true ) < $deadline ) {
			self::step();
		}
		if ( self::is_running() ) {
			if ( function_exists( 'as_enqueue_async_action' ) ) {
				as_enqueue_async_action( self::HOOK, array(), 'silo' );
			} else {
				wp_schedule_single_event( time(), self::HOOK );
			}
		}
	}

	/**
	 * Start background.
	 *
	 * @param string $origin Origin.
	 */
	public static function start_background( string $origin ): array {
		$state = self::start( $origin );
		if ( function_exists( 'as_enqueue_async_action' ) ) {
			as_enqueue_async_action( self::HOOK, array(), 'silo' );
		} else {
			wp_schedule_single_event( time(), self::HOOK );
		}
		return $state;
	}

	/**
	 * Advance.
	 *
	 * @param array  $state State.
	 * @param string $next Next.
	 */
	private static function advance( array &$state, string $next ): void {
		$state['stage']   = $next;
		$state['percent'] = self::STAGES[ $next ]['from'];
	}

	/**
	 * Log.
	 *
	 * @param array  $state State.
	 * @param string $message Message.
	 */
	private static function log( array &$state, string $message ): void {
		$state['log'][] = array(
			't' => time(),
			'm' => $message,
		);
		$state['log']   = array_slice( $state['log'], -14 );
	}

	// Stages.

	/**
	 * Scan stage: environment.
	 *
	 * @param array $state State.
	 */
	private static function stage_environment( array &$state ): void {
		global $wpdb;

		$languages     = self::languages();
		$currencies    = self::currencies();
		$permalinks    = (string) get_option( 'permalink_structure' );
		$hpos          = class_exists( '\Automattic\WooCommerce\Utilities\OrderUtil' ) && \Automattic\WooCommerce\Utilities\OrderUtil::custom_orders_table_usage_is_enabled();
		$conflicts     = Silo_Status::cache_conflicts();
		$checkout_page = function_exists( 'wc_get_page_id' ) ? wc_get_page_id( 'checkout' ) : 0;

		$state['env'] = array(
			'wp'              => get_bloginfo( 'version' ),
			'wc'              => defined( 'WC_VERSION' ) ? WC_VERSION : '',
			'php'             => PHP_VERSION,
			'mysql'           => (string) $wpdb->db_version(),
			'hpos'            => $hpos,
			'pretty'          => '' !== $permalinks,
			'multisite'       => is_multisite(),
			'languages'       => $languages['codes'],
			'language_plugin' => $languages['plugin'],
			'language_cookie' => $languages['cookie'],
			'currencies'      => $currencies['codes'],
			'currency_plugin' => $currencies['plugin'],
			'base_currency'   => get_woocommerce_currency(),
			'conflicts'       => $conflicts,
			'dropin'          => Silo_Installer::dropin_status(),
			'block_checkout'  => $checkout_page > 0 && has_block( 'woocommerce/checkout', $checkout_page ),
			'hide_oos'        => 'yes' === get_option( 'woocommerce_hide_out_of_stock_items' ),
			'stock_mgmt'      => 'yes' === get_option( 'woocommerce_manage_stock' ),
			'geolocation'     => (string) get_option( 'woocommerce_default_customer_address', '' ),
			'tax_display'     => (string) get_option( 'woocommerce_tax_display_shop', 'excl' ),
			'calc_taxes'      => 'yes' === get_option( 'woocommerce_calc_taxes' ),
			'theme'           => get_stylesheet(),
		);

		self::log( $state, sprintf( 'WordPress %s · WooCommerce %s · PHP %s', $state['env']['wp'], $state['env']['wc'], PHP_VERSION ) );
		self::log( $state, $hpos ? 'HPOS order storage detected' : 'Legacy order storage detected' );
		if ( $languages['codes'] ) {
			self::log( $state, sprintf( '%s · languages: %s', $languages['plugin'], implode( ', ', $languages['codes'] ) ) );
		}
		if ( count( $currencies['codes'] ) > 1 ) {
			self::log( $state, sprintf( '%s · currencies: %s', $currencies['plugin'], implode( ', ', $currencies['codes'] ) ) );
		}
		if ( $conflicts ) {
			self::log( $state, implode( ', ', $conflicts ) . ' detected — Silo works alongside it and purges its cache in step' );
		}
		if ( '' === $permalinks ) {
			self::log( $state, 'Plain permalinks detected — enable pretty permalinks for page caching' );
		}

		self::advance( $state, 'catalog' );
	}

	/**
	 * Scan stage: catalog.
	 *
	 * @param array $state State.
	 */
	private static function stage_catalog( array &$state ): void {
		global $wpdb;

		$ids = array_map(
			'intval',
			(array) $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish' AND ID > %d ORDER BY ID ASC LIMIT %d", (int) $state['cursor'], self::BATCH ) )
		);

		if ( ! $ids ) {
			self::log(
				$state,
				sprintf(
					'Catalog mapped · %s products · %s variations',
					number_format_i18n( $state['counts']['products'] ),
					number_format_i18n( $state['counts']['variations'] )
				)
			);
			self::advance( $state, 'taxonomies' );
			return;
		}

		$in = implode( ',', $ids );

		// Product types (simple, variable, grouped, external and any extension type).
		$typed = 0;
		$rows  = (array) $wpdb->get_results( "SELECT t.slug AS type, COUNT(*) AS n FROM {$wpdb->term_relationships} tr INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id AND tt.taxonomy = 'product_type' INNER JOIN {$wpdb->terms} t ON t.term_id = tt.term_id WHERE tr.object_id IN ({$in}) GROUP BY t.slug", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		foreach ( $rows as $row ) {
			$state['types'][ $row['type'] ] = (int) ( $state['types'][ $row['type'] ] ?? 0 ) + (int) $row['n'];
			$typed                         += (int) $row['n'];
		}
		if ( count( $ids ) > $typed ) {
			$state['types']['simple'] = (int) ( $state['types']['simple'] ?? 0 ) + ( count( $ids ) - $typed );
		}

		// Stock status of products.
		$lookup = $wpdb->prefix . 'wc_product_meta_lookup';
		$rows   = (array) $wpdb->get_results( "SELECT stock_status, COUNT(*) AS n FROM {$lookup} WHERE product_id IN ({$in}) GROUP BY stock_status", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		foreach ( $rows as $row ) {
			$key = (string) $row['stock_status'];
			if ( isset( $state['stock'][ $key ] ) ) {
				$state['stock'][ $key ] += (int) $row['n'];
			}
		}
		$state['stock']['managed'] += (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE post_id IN ({$in}) AND meta_key = '_manage_stock' AND meta_value = 'yes'" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		// Variations: each one is its own cache node.
		$rows       = (array) $wpdb->get_results( "SELECT COALESCE(l.stock_status, 'instock') AS stock_status, COUNT(*) AS n FROM {$wpdb->posts} v LEFT JOIN {$lookup} l ON l.product_id = v.ID WHERE v.post_type = 'product_variation' AND v.post_status IN ('publish','private') AND v.post_parent IN ({$in}) GROUP BY stock_status", ARRAY_A ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
		$variations = 0;
		foreach ( $rows as $row ) {
			$variations += (int) $row['n'];
			$key         = (string) $row['stock_status'];
			if ( isset( $state['variation_stock'][ $key ] ) ) {
				$state['variation_stock'][ $key ] += (int) $row['n'];
			}
		}

		// Graph edges: product → term assignments, variation → parent.
		$edges = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->term_relationships} tr INNER JOIN {$wpdb->term_taxonomy} tt ON tt.term_taxonomy_id = tr.term_taxonomy_id WHERE tr.object_id IN ({$in}) AND ( tt.taxonomy IN ('product_cat','product_tag','product_brand') OR tt.taxonomy LIKE 'pa\\_%' )" ); // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared

		$state['counts']['products']   += count( $ids );
		$state['counts']['variations'] += $variations;
		$state['counts']['edges']      += $edges + $variations;
		$state['cursor']                = (int) end( $ids );

		$total            = max( 1, (int) $state['total'] );
		$state['percent'] = (int) min( 61, self::STAGES['catalog']['from'] + floor( self::STAGES['catalog']['weight'] * min( 1, $state['counts']['products'] / $total ) ) );

		self::log(
			$state,
			sprintf(
				'Mapped %s / %s products · %s variations',
				number_format_i18n( $state['counts']['products'] ),
				number_format_i18n( $total ),
				number_format_i18n( $state['counts']['variations'] )
			)
		);
	}

	/**
	 * Scan stage: taxonomies.
	 *
	 * @param array $state State.
	 */
	private static function stage_taxonomies( array &$state ): void {
		$taxonomies = array(
			'product_cat' => __( 'Categories', 'silo-connector' ),
			'product_tag' => __( 'Tags', 'silo-connector' ),
		);
		if ( taxonomy_exists( 'product_brand' ) ) {
			$taxonomies['product_brand'] = __( 'Brands', 'silo-connector' );
		}
		foreach ( wc_get_attribute_taxonomies() as $attribute ) {
			$taxonomies[ wc_attribute_taxonomy_name( $attribute->attribute_name ) ] = $attribute->attribute_label;
		}

		$archives = 0;
		foreach ( $taxonomies as $taxonomy => $label ) {
			if ( ! taxonomy_exists( $taxonomy ) ) {
				continue;
			}
			$object   = get_taxonomy( $taxonomy );
			$terms    = (int) wp_count_terms(
				array(
					'taxonomy'   => $taxonomy,
					'hide_empty' => false,
				)
			);
			$nonempty = (int) wp_count_terms(
				array(
					'taxonomy'   => $taxonomy,
					'hide_empty' => true,
				)
			);
			$public   = $object && $object->public && $object->publicly_queryable;

			$state['taxonomies'][ $taxonomy ] = array(
				'label'    => (string) $label,
				'terms'    => $terms,
				'archives' => $public ? $nonempty : 0,
				'public'   => $public,
			);
			$archives                        += $public ? $nonempty : 0;
		}

		$state['counts']['archives'] = $archives + 1; // Plus the shop page itself.
		self::log( $state, sprintf( 'Resolved %s archives across %d taxonomies', number_format_i18n( $state['counts']['archives'] ), count( $state['taxonomies'] ) ) );
		self::advance( $state, 'store_api' );
	}

	/**
	 * Scan stage: store api.
	 *
	 * @param array $state State.
	 */
	private static function stage_store_api( array &$state ): void {
		// The full route table, filtered by prefix: namespace lookups miss Store API routes on recent WooCommerce.
		$routes    = array_filter(
			array_keys( rest_get_server()->get_routes() ),
			static function ( $route ) {
				return str_starts_with( (string) $route, '/wc/store/v1/' );
			}
		);
		$cacheable = array();
		$private   = array();
		foreach ( $routes as $route ) {
			if ( preg_match( Silo_Store_API_Cache::CACHEABLE, preg_replace( '#\(\?P<[^>]+>[^)]+\)#', '1', $route ) ) ) {
				$cacheable[] = $route;
			} elseif ( '/wc/store/v1' !== $route ) {
				$private[] = $route;
			}
		}

		if ( ! $cacheable && class_exists( '\Automattic\WooCommerce\StoreApi\StoreApi' ) ) {
			// Routes were not registered in this request; use WooCommerce's standard catalog routes.
			$cacheable = array(
				'/wc/store/v1/products',
				'/wc/store/v1/products/(?P<id>[\d]+)',
				'/wc/store/v1/products/collection-data',
				'/wc/store/v1/products/categories',
				'/wc/store/v1/products/tags',
				'/wc/store/v1/products/attributes',
				'/wc/store/v1/products/reviews',
			);
			$private   = array( '/wc/store/v1/cart', '/wc/store/v1/checkout', '/wc/store/v1/batch', '/wc/store/v1/order' );
			self::log( $state, 'Store API routes inferred from WooCommerce defaults' );
		}

		$state['routes']           = array(
			'cacheable' => $cacheable,
			'private'   => count( $private ),
		);
		$state['counts']['routes'] = count( $cacheable );
		self::log( $state, sprintf( '%d catalog routes cacheable · %d cart/checkout routes kept private', count( $cacheable ), count( $private ) ) );
		self::advance( $state, 'priority' );
	}

	/**
	 * How many top products the priority list ranks: the plan's warmup limit from the last
	 * config Silo sent, kept between 50 and 1,500.
	 */
	private static function priority_product_count(): int {
		$config = Silo_Settings::remote_config();
		$cap    = (int) ( $config['limits']['warmup_urls_per_event'] ?? 50 );
		return max( 50, min( 1500, $cap ) );
	}

	/**
	 * Scan stage: priority.
	 *
	 * @param array $state State.
	 */
	private static function stage_priority( array &$state ): void {
		global $wpdb;

		$count  = self::priority_product_count();
		$lookup = $wpdb->prefix . 'wc_product_meta_lookup';
		$best   = array_map( 'intval', (array) $wpdb->get_col( $wpdb->prepare( "SELECT l.product_id FROM {$lookup} l INNER JOIN {$wpdb->posts} p ON p.ID = l.product_id AND p.post_type = 'product' AND p.post_status = 'publish' WHERE l.total_sales > 0 ORDER BY l.total_sales DESC LIMIT %d", $count ) ) );

		if ( count( $best ) < $count ) {
			$featured = function_exists( 'wc_get_featured_product_ids' ) ? array_map( 'intval', wc_get_featured_product_ids() ) : array();
			$recent   = array_map( 'intval', (array) $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'product' AND post_status = 'publish' ORDER BY post_date DESC LIMIT %d", $count ) ) );
			$best     = array_values( array_unique( array_merge( $best, $featured, $recent ) ) );
		}
		$best = array_slice( $best, 0, $count );

		$urls = array();
		$shop = wc_get_page_permalink( 'shop' );
		if ( $shop ) {
			$urls[] = $shop;
		}
		if ( Silo_Settings::get( 'cache_front_page' ) ) {
			$urls[] = home_url( '/' );
		}
		foreach ( array_slice( $best, 0, 25 ) as $id ) {
			$urls[] = (string) get_permalink( $id );
		}
		$categories = get_terms(
			array(
				'taxonomy'   => 'product_cat',
				'orderby'    => 'count',
				'order'      => 'DESC',
				'number'     => 12,
				'hide_empty' => true,
			)
		);
		if ( is_array( $categories ) ) {
			foreach ( $categories as $category ) {
				$link = get_term_link( $category );
				if ( is_string( $link ) ) {
					$urls[] = $link;
				}
			}
		}
		foreach ( array_slice( $best, 25 ) as $id ) {
			$urls[] = (string) get_permalink( $id );
		}

		// Store API catalog reads used by Product Collection / All Products blocks.
		$api    = rest_url( 'wc/store/v1/products' );
		$urls[] = add_query_arg( array( 'per_page' => 12 ), $api );
		$urls[] = rest_url( 'wc/store/v1/products/categories' );
		if ( is_array( $categories ) ) {
			foreach ( array_slice( $categories, 0, 3 ) as $category ) {
				$urls[] = add_query_arg(
					array(
						'category' => $category->term_id,
						'per_page' => 12,
					),
					$api
				);
			}
		}

		$state['bestsellers']        = $best;
		$state['priority']           = array_values( array_unique( array_filter( $urls ) ) );
		$state['counts']['priority'] = count( $state['priority'] );
		self::log( $state, sprintf( 'Priority queue scored · %d URLs (shop, bestsellers, top categories)', count( $state['priority'] ) ) );
		self::advance( $state, 'sync' );
	}

	/**
	 * Scan stage: sync.
	 *
	 * @param array $state State.
	 */
	private static function stage_sync( array &$state ): void {
		$snapshot = self::snapshot( $state );
		$response = Silo_Api::post( '/api/stores/connect', array( 'snapshot' => $snapshot ), 30 );

		if ( is_wp_error( $response ) || 200 !== $response['code'] ) {
			$state['status'] = 'failed';
			$state['error']  = Silo_Api::error_message( $response );
			self::log( $state, 'Silo could not generate the profile: ' . $state['error'] );
			return;
		}

		$body   = $response['body'];
		$config = is_array( $body['config'] ?? null ) ? $body['config'] : array();
		if ( $config ) {
			Silo_Settings::apply_remote_config( $config );
		}

		$store         = Silo_Settings::store();
		$store['tier'] = (string) ( $config['tier'] ?? ( $store['tier'] ?? '' ) );
		update_option( 'silo_store', $store, false );

		$sales = Silo_Sales::schedule_all();
		if ( $sales ) {
			self::log( $state, sprintf( 'Sale boundaries scheduled for %d products', $sales ) );
		}

		$warm  = (array) ( $body['warmup']['urls'] ?? array() );
		$job   = (string) ( $body['warmup']['job_id'] ?? '' );
		$added = ( $warm && '' !== $job ) ? Silo_Warmup::enqueue( $warm, $job, 'scan' ) : 0;

		$state['result']  = array(
			'config_version' => (int) ( $config['version'] ?? 0 ),
			'tier'           => (string) ( $config['tier'] ?? '' ),
			'warm_job'       => $job,
			'warm_total'     => $added,
			'warning'        => (string) ( $body['warning']['instructions'] ?? '' ),
		);
		$state['status']  = 'complete';
		$state['percent'] = 100;
		$state['stage']   = 'done';

		self::log( $state, sprintf( 'Profile v%d applied · %s plan', $state['result']['config_version'], ucfirst( $state['result']['tier'] ) ) );
		if ( $added ) {
			self::log( $state, sprintf( 'Initial warmup queued · %d priority URLs', $added ) );
		}
		self::log( $state, 'Catalog is live in Silo' );

		Silo_Log::insert(
			array(
				'type'    => 'system.scan',
				'object'  => __( 'Catalog scan', 'silo-connector' ),
				/* translators: 1: products, 2: variations, 3: archives */
				'detail'  => sprintf( __( '%1$s products · %2$s variations · %3$s archives', 'silo-connector' ), number_format_i18n( $state['counts']['products'] ), number_format_i18n( $state['counts']['variations'] ), number_format_i18n( $state['counts']['archives'] ) ),
				'state'   => 'done',
				'payload' => array( 'counts' => $state['counts'] ),
			)
		);
		Silo_Heartbeat::send( false );
	}

	/**
	 * Snapshot sent to Silo when the scan completes.
	 *
	 * @param array $state State.
	 */
	public static function snapshot( array $state ): array {
		$types     = $state['types'];
		$variable  = (int) ( $types['variable'] ?? 0 ) + (int) ( $types['variable-subscription'] ?? 0 );
		$per       = $variable > 0 ? $state['counts']['variations'] / $variable : 0;
		$languages = (array) ( $state['env']['languages'] ?? array() );

		$attributes = array();
		foreach ( $state['taxonomies'] as $taxonomy => $info ) {
			if ( str_starts_with( $taxonomy, 'pa_' ) ) {
				$attributes[] = array(
					'taxonomy' => $taxonomy,
					'label'    => $info['label'],
					'terms'    => $info['terms'],
					'public'   => $info['public'],
				);
			}
		}

		return array(
			'url'                  => home_url(),
			'home_url'             => home_url( '/' ),
			'shop_url'             => (string) wc_get_page_permalink( 'shop' ),
			'product_count'        => (int) $state['counts']['products'],
			'product_types'        => $types,
			'variation_count'      => (int) $state['counts']['variations'],
			'variation_complexity' => ( $per >= 6 || $state['counts']['variations'] > 2000 ) ? 'high' : 'low',
			'stock_management'     => (bool) ( $state['env']['stock_mgmt'] ?? true ),
			'stock'                => $state['stock'],
			'variation_stock'      => $state['variation_stock'],
			'hide_out_of_stock'    => (bool) ( $state['env']['hide_oos'] ?? false ),
			'taxonomies'           => $state['taxonomies'],
			'attributes'           => $attributes,
			'category_count'       => (int) ( $state['taxonomies']['product_cat']['terms'] ?? 0 ),
			'tag_count'            => (int) ( $state['taxonomies']['product_tag']['terms'] ?? 0 ),
			'archive_count'        => (int) $state['counts']['archives'],
			'store_api_routes'     => (array) ( $state['routes']['cacheable'] ?? array() ),
			'private_route_count'  => (int) ( $state['routes']['private'] ?? 0 ),
			'hpos'                 => (bool) ( $state['env']['hpos'] ?? false ),
			'multilingual'         => $languages,
			'language_cookie'      => (bool) ( $state['env']['language_cookie'] ?? false ),
			'geolocation'          => (string) ( $state['env']['geolocation'] ?? '' ),
			'calc_taxes'           => (bool) ( $state['env']['calc_taxes'] ?? false ),
			'multi_currency'       => count( (array) ( $state['env']['currencies'] ?? array() ) ) > 1,
			'currencies'           => (array) ( $state['env']['currencies'] ?? array() ),
			'bestsellers'          => $state['bestsellers'],
			'priority_urls'        => $state['priority'],
			'exclude_paths'        => Silo_Settings::exclude_paths(),
			'existing_cache'       => self::conflict_slug( (array) ( $state['env']['conflicts'] ?? array() ) ),
			'conflicts'            => (array) ( $state['env']['conflicts'] ?? array() ),
			'graph'                => array(
				'nodes' => (int) $state['counts']['nodes'],
				'edges' => (int) $state['counts']['edges'],
			),
			'environment'          => $state['env'],
			'connector_version'    => SILO_VERSION,
			'scanned_at'           => gmdate( 'c' ),
			'scan_ms'              => max( 0, ( time() - (int) $state['started_at'] ) * 1000 ),
		);
	}

	/**
	 * Conflict slug.
	 *
	 * @param array $conflicts Conflicts.
	 */
	private static function conflict_slug( array $conflicts ): ?string {
		if ( ! $conflicts ) {
			return null;
		}
		return sanitize_title( (string) $conflicts[0] );
	}

	/**
	 * Detected multilingual setup.
	 */
	private static function languages(): array {
		if ( defined( 'ICL_SITEPRESS_VERSION' ) ) {
			$codes = array_keys( (array) apply_filters( 'wpml_active_languages', array(), array( 'skip_missing' => 0 ) ) ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's public API filter.
			$mode  = (int) apply_filters( 'wpml_setting', 1, 'language_negotiation_type' ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- WPML's public API filter.
			return array(
				'plugin' => 'WPML',
				'codes'  => $codes,
				'cookie' => 3 === $mode,
			);
		}
		if ( function_exists( 'pll_languages_list' ) ) {
			$options = (array) get_option( 'polylang', array() );
			return array(
				'plugin' => 'Polylang',
				'codes'  => (array) pll_languages_list(),
				'cookie' => 0 === (int) ( $options['force_lang'] ?? 1 ),
			);
		}
		if ( class_exists( 'TRP_Translate_Press' ) ) {
			$settings = (array) get_option( 'trp_settings', array() );
			return array(
				'plugin' => 'TranslatePress',
				'codes'  => (array) ( $settings['publish-languages'] ?? array() ),
				'cookie' => false,
			);
		}
		return array(
			'plugin' => '',
			'codes'  => array(),
			'cookie' => false,
		);
	}

	/**
	 * Detected multi-currency setup.
	 */
	private static function currencies(): array {
		$base = get_woocommerce_currency();
		if ( class_exists( 'woocommerce_wpml' ) ) {
			$settings = (array) get_option( '_wcml_settings', array() );
			$codes    = array_keys( (array) ( $settings['currency_options'] ?? array() ) );
			return array(
				'plugin' => 'WCML',
				'codes'  => $codes ? $codes : array( $base ),
			);
		}
		if ( class_exists( 'WOOCS' ) ) {
			return array(
				'plugin' => 'WOOCS',
				'codes'  => array_keys( (array) get_option( 'woocs', array() ) ),
			);
		}
		if ( class_exists( 'WOOMULTI_CURRENCY_F' ) || class_exists( 'WOOMULTI_CURRENCY' ) ) {
			$params = (array) get_option( 'woo_multi_currency_params', array() );
			return array(
				'plugin' => 'CURCY',
				'codes'  => (array) ( $params['currency'] ?? array( $base ) ),
			);
		}
		if ( class_exists( 'Aelia_CurrencySwitcher' ) || class_exists( 'WC_Aelia_CurrencySwitcher' ) ) {
			return array(
				'plugin' => 'Aelia',
				'codes'  => array( $base ),
			);
		}
		return array(
			'plugin' => '',
			'codes'  => array( $base ),
		);
	}

	/**
	 * Push progress to Silo so the dashboard animates the same scan.
	 *
	 * @param array $state State.
	 */
	private static function report( array $state ): void {
		if ( '' === Silo_Settings::api_key() ) {
			return;
		}
		Silo_Api::post( '/api/stores/scan', array( 'state' => self::public_state( $state ) ), 6 );
	}

	/**
	 * State without internal cursors, safe to render.
	 *
	 * @param array|null $state State.
	 */
	public static function public_state( ?array $state = null ): array {
		$state = $state ?? self::state();
		if ( ! $state ) {
			return array();
		}
		$stages = array();
		foreach ( self::STAGES as $key => $stage ) {
			$position = array_search( $state['stage'], array_keys( self::STAGES ), true );
			$index    = array_search( $key, array_keys( self::STAGES ), true );
			$done     = 'complete' === $state['status'] || ( false !== $position && $index < $position );
			$stages[] = array(
				'key'   => $key,
				'label' => $stage['label'],
				'state' => $done ? 'done' : ( $key === $state['stage'] ? ( 'failed' === $state['status'] ? 'failed' : 'active' ) : 'pending' ),
			);
		}

		return array(
			'id'              => $state['id'],
			'status'          => $state['status'],
			'origin'          => $state['origin'],
			'stage'           => $state['stage'],
			'stages'          => $stages,
			'percent'         => (int) $state['percent'],
			'started_at'      => (int) $state['started_at'],
			'finished_at'     => (int) $state['finished_at'],
			'error'           => (string) $state['error'],
			'total'           => (int) $state['total'],
			'counts'          => $state['counts'],
			'types'           => $state['types'],
			'stock'           => $state['stock'],
			'variation_stock' => $state['variation_stock'],
			'taxonomies'      => $state['taxonomies'],
			'routes'          => count( (array) ( $state['routes']['cacheable'] ?? array() ) ),
			'priority'        => count( (array) $state['priority'] ),
			'env'             => array(
				'hpos'       => (bool) ( $state['env']['hpos'] ?? false ),
				'languages'  => (array) ( $state['env']['languages'] ?? array() ),
				'currencies' => (array) ( $state['env']['currencies'] ?? array() ),
				'conflicts'  => (array) ( $state['env']['conflicts'] ?? array() ),
				'wc'         => (string) ( $state['env']['wc'] ?? '' ),
				'pretty'     => (bool) ( $state['env']['pretty'] ?? true ),
			),
			'log'             => $state['log'],
			'result'          => $state['result'],
		);
	}
}
