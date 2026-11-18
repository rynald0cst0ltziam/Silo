<?php
/**
 * Event reporter: hooks into WooCommerce actions, POSTs signed payloads to SaaS.
 *
 * @package silo-connector
 */

defined('ABSPATH') || exit;

class Silo_Event_Reporter {

    private array $queued_events = [];

    public function register_hooks(): void {
        if (get_option('silo_events_enabled', '1') !== '1') {
            return;
        }

        // Product updates
        add_action('woocommerce_update_product', [$this, 'on_product_update'], 10, 2);
        add_action('woocommerce_new_product_variation', [$this, 'on_variation_created'], 10, 1);

        // Stock changes
        add_action('woocommerce_product_set_stock', [$this, 'on_stock_change'], 10, 1);
        add_action('woocommerce_variation_set_stock', [$this, 'on_stock_change'], 10, 1);

        // Order status changes
        add_action('woocommerce_order_status_changed', [$this, 'on_order_status_changed'], 10, 4);

        // Product property updates (catches meta, attributes, etc.)
        add_action('woocommerce_product_object_updated_props', [$this, 'on_product_props_updated'], 10, 2);

        // Sale price scheduling
        add_action('woocommerce_scheduled_sales', [$this, 'on_scheduled_sales']);

        // Flush queued events at shutdown
        add_action('shutdown', [$this, 'flush_events']);
    }

    public function on_product_update(int $product_id, \WC_Product $product): void {
        $this->queue_event('product_updated', [
            'product_id'   => $product_id,
            'product_type' => $product->get_type(),
            'name'         => $product->get_name(),
            'url'          => get_permalink($product_id),
            'categories'   => $this->get_product_category_urls($product_id),
            'parent_id'    => $product->get_parent_id(),
        ]);
    }

    public function on_variation_created(int $variation_id): void {
        $variation = wc_get_product($variation_id);
        if (!$variation) return;

        $this->queue_event('variation_created', [
            'variation_id' => $variation_id,
            'parent_id'    => $variation->get_parent_id(),
            'url'          => get_permalink($variation->get_parent_id()),
        ]);
    }

    public function on_stock_change(\WC_Product $product): void {
        $product_id = $product->get_id();
        $parent_id  = $product->get_parent_id();

        $this->queue_event('stock_changed', [
            'product_id'       => $product_id,
            'product_type'     => $product->get_type(),
            'parent_id'        => $parent_id,
            'sku'              => $product->get_sku(),
            'stock_quantity'   => $product->get_stock_quantity(),
            'stock_status'     => $product->get_stock_status(),
            'managing_stock'   => $product->get_manage_stock(),
            'url'              => get_permalink($parent_id ?: $product_id),
            'categories'       => $this->get_product_category_urls($parent_id ?: $product_id),
        ]);
    }

    public function on_order_status_changed(int $order_id, string $from, string $to, \WC_Order $order): void {
        $product_ids = [];
        foreach ($order->get_items() as $item) {
            if ($item instanceof \WC_Order_Item_Product) {
                $pid = $item->get_product_id();
                $vid = $item->get_variation_id();
                $product_ids[] = [
                    'product_id'   => $pid,
                    'variation_id' => $vid ?: null,
                    'quantity'     => $item->get_quantity(),
                    'url'          => get_permalink($pid),
                    'categories'   => $this->get_product_category_urls($pid),
                ];
            }
        }

        $this->queue_event('order_status_changed', [
            'order_id' => $order_id,
            'from'     => $from,
            'to'       => $to,
            'products' => $product_ids,
        ]);
    }

    public function on_product_props_updated(\WC_Product $product, array $updated_props): void {
        $watched = ['regular_price', 'sale_price', 'date_on_sale_from', 'date_on_sale_to', 'stock_quantity', 'stock_status', 'attributes'];
        $relevant = array_intersect($updated_props, $watched);

        if (empty($relevant)) return;

        $product_id = $product->get_id();

        $this->queue_event('product_props_updated', [
            'product_id'    => $product_id,
            'product_type'  => $product->get_type(),
            'updated_props' => array_values($relevant),
            'url'           => get_permalink($product_id),
            'categories'    => $this->get_product_category_urls($product_id),
        ]);
    }

    public function on_scheduled_sales(): void {
        $product_urls = $this->get_sale_transition_urls();
        $this->queue_event('sale_boundary', [
            'type'         => 'scheduled_sales_processed',
            'product_urls' => $product_urls,
        ]);
    }

    private function get_sale_transition_urls(): array {
        $urls = [];
        $now = current_time('timestamp', true);
        $window = 120; // 2 minutes around the boundary

        $args = [
            'post_type'      => 'product',
            'post_status'    => 'publish',
            'posts_per_page' => 50,
            'meta_query'     => [
                'relation' => 'OR',
                [
                    'key'     => '_sale_price_dates_from',
                    'value'   => [$now - $window, $now + $window],
                    'compare' => 'BETWEEN',
                    'type'    => 'NUMERIC',
                ],
                [
                    'key'     => '_sale_price_dates_to',
                    'value'   => [$now - $window, $now + $window],
                    'compare' => 'BETWEEN',
                    'type'    => 'NUMERIC',
                ],
            ],
        ];

        $query = new \WP_Query($args);
        foreach ($query->posts as $post) {
            $url = get_permalink($post->ID);
            if ($url) {
                $urls[] = $url;
            }
            $categories = $this->get_product_category_urls($post->ID);
            $urls = array_merge($urls, $categories);
        }

        return array_values(array_unique($urls));
    }

    private function queue_event(string $type, array $payload): void {
        $dedup_key = $type . ':' . ($payload['product_id'] ?? $payload['order_id'] ?? 'global');

        if (isset($this->queued_events[$dedup_key])) {
            return;
        }

        $this->queued_events[$dedup_key] = [
            'type'      => $type,
            'payload'   => $payload,
            'timestamp' => time(),
        ];
    }

    public function flush_events(): void {
        if (empty($this->queued_events)) {
            return;
        }

        $api_key  = silo()->get_api_key();
        $saas_url = silo()->get_saas_url();
        $endpoint = $saas_url . '/api/events';

        foreach ($this->queued_events as $event) {
            $body      = wp_json_encode($event);
            $timestamp = (string) time();
            $signature = hash_hmac('sha256', $timestamp . '.' . $body, $api_key);

            $args = [
                'timeout' => 15,
                'headers' => [
                    'Content-Type'     => 'application/json',
                    'X-Silo-Signature' => $signature,
                    'X-Silo-Timestamp' => $timestamp,
                    'X-Silo-Store-Key' => $api_key,
                ],
                'body'    => $body,
            ];

            $response = wp_remote_post($endpoint, $args);

            // Retry once on network error or 5xx
            if (is_wp_error($response) || wp_remote_retrieve_response_code($response) >= 500) {
                usleep(500000); // 500ms
                $timestamp = (string) time();
                $signature = hash_hmac('sha256', $timestamp . '.' . $body, $api_key);
                $args['headers']['X-Silo-Signature'] = $signature;
                $args['headers']['X-Silo-Timestamp'] = $timestamp;
                $response = wp_remote_post($endpoint, $args);
            }

            if (is_wp_error($response)) {
                error_log('[Silo] Event POST failed: ' . $response->get_error_message());
                $this->log_activity($event['type'], 'POST failed: ' . $response->get_error_message());
                continue;
            }

            $status = wp_remote_retrieve_response_code($response);
            $result = json_decode(wp_remote_retrieve_body($response), true);

            $this->log_activity($event['type'], 'HTTP ' . $status . ' — purge:' . count($result['purge'] ?? []) . ' warm:' . count($result['warm'] ?? []));

            if ($status === 200 && !empty($result['purge'])) {
                silo()->page_cache()->purge_urls($result['purge']);
            }

            if ($status === 200 && !empty($result['warm'])) {
                silo()->warmup()->warm_urls($result['warm']);
            }

            if ($status === 429) {
                error_log('[Silo] Rate limited — pausing event flush');
                break;
            }

            if ($status >= 400) {
                error_log('[Silo] Event rejected (HTTP ' . $status . '): ' . ($result['error'] ?? 'unknown'));
            }
        }

        $this->queued_events = [];
    }

    private function log_activity(string $event, string $detail): void {
        $log_file = SILO_CACHE_DIR . '.activity.log';
        $line = gmdate('Y-m-d H:i:s') . '|' . $event . '|' . $detail . "\n";
        file_put_contents($log_file, $line, FILE_APPEND | LOCK_EX);

        // Keep log under 500 lines
        if (file_exists($log_file) && rand(1, 20) === 1) {
            $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines && count($lines) > 500) {
                $lines = array_slice($lines, -500);
                file_put_contents($log_file, implode("\n", $lines) . "\n", LOCK_EX);
            }
        }
    }

    private function get_product_category_urls(int $product_id): array {
        $terms = get_the_terms($product_id, 'product_cat');
        if (!$terms || is_wp_error($terms)) {
            return [];
        }

        $urls = [];
        foreach ($terms as $term) {
            $url = get_term_link($term);
            if (!is_wp_error($url)) {
                $urls[] = $url;
            }
        }

        return $urls;
    }
}
