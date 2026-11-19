<?php
/**
 * Exact-time sale boundaries.
 *
 * WooCommerce evaluates sale dates when a product is rendered, but its own scheduled
 * sales task only runs once a day. A cached page would therefore keep the old price
 * after a sale starts or ends. Silo schedules a purge for each product at the moment
 * its sale starts and ends (with a safety pass shortly after), and recovers boundaries
 * that were missed while background processing was paused.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.DB.DirectDatabaseQuery

/**
 * Sale boundary scheduler.
 */
class Silo_Sales {

	const HOOK  = 'silo_sale_boundary';
	const KINDS = array( 'start', 'end', 'end_safety' );

	/**
	 * Register hooks.
	 */
	public static function init(): void {
		add_action( self::HOOK, array( __CLASS__, 'handle' ), 10, 2 );
	}

	/**
	 * (Re)schedule the boundaries of one product (variations roll up to the parent).
	 *
	 * @param WC_Product|int $product Product or ID.
	 */
	public static function schedule_for( $product ): void {
		$product = $product instanceof WC_Product ? $product : wc_get_product( $product );
		if ( ! $product || ! function_exists( 'as_schedule_single_action' ) ) {
			return;
		}
		$root = $product->get_parent_id() > 0 ? wc_get_product( $product->get_parent_id() ) : $product;
		if ( ! $root ) {
			return;
		}
		$id = $root->get_id();

		foreach ( self::KINDS as $kind ) {
			as_unschedule_all_actions( self::HOOK, array( $id, $kind ), 'silo' );
		}

		$from = null;
		$to   = null;
		$all  = $root->is_type( 'variable' ) ? array_filter( array_map( 'wc_get_product', $root->get_children() ) ) : array( $root );
		foreach ( $all as $item ) {
			$start = $item->get_date_on_sale_from();
			$end   = $item->get_date_on_sale_to();
			if ( $start instanceof WC_DateTime && $start->getTimestamp() > time() ) {
				$from = null === $from ? $start->getTimestamp() : min( $from, $start->getTimestamp() );
			}
			if ( $end instanceof WC_DateTime && $end->getTimestamp() > time() ) {
				$to = null === $to ? $end->getTimestamp() : min( $to, $end->getTimestamp() );
			}
		}

		if ( null !== $from ) {
			as_schedule_single_action( $from + 1, self::HOOK, array( $id, 'start' ), 'silo' );
		}
		if ( null !== $to ) {
			as_schedule_single_action( $to + 1, self::HOOK, array( $id, 'end' ), 'silo' );
			as_schedule_single_action( $to + 30, self::HOOK, array( $id, 'end_safety' ), 'silo' );
		}
	}

	/**
	 * Schedule every upcoming boundary in the catalog (after a scan).
	 */
	public static function schedule_all(): int {
		global $wpdb;
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				"SELECT DISTINCT IF(p.post_type = 'product_variation', p.post_parent, p.ID) FROM {$wpdb->postmeta} m INNER JOIN {$wpdb->posts} p ON p.ID = m.post_id WHERE m.meta_key IN ('_sale_price_dates_from','_sale_price_dates_to') AND CAST(m.meta_value AS UNSIGNED) > %d LIMIT 2000",
				time()
			)
		);
		foreach ( (array) $ids as $id ) {
			self::schedule_for( (int) $id );
		}
		return count( (array) $ids );
	}

	/**
	 * A boundary passed: invalidate the product so the new price is rendered.
	 *
	 * @param int    $product_id Product ID.
	 * @param string $kind       start | end | end_safety.
	 */
	public static function handle( $product_id, $kind = 'start' ): void {
		Silo_Events::sale_boundary( (int) $product_id, (string) $kind );
		if ( 'end_safety' !== $kind ) {
			self::schedule_for( (int) $product_id );
		}
	}
}
