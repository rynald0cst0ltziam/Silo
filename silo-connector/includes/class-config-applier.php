<?php
/**
 * Config applier: receives config from SaaS via REST endpoint,
 * writes it to options, and applies purge/warm instructions.
 *
 * @package silo-connector
 */

defined('ABSPATH') || exit;

class Silo_Config_Applier {

    public function register_routes(): void {
        register_rest_route('silo/v1', '/apply', [
            'methods'             => 'POST',
            'callback'            => [$this, 'handle_apply'],
            'permission_callback' => [silo(), 'verify_hmac'],
        ]);
    }

    public function handle_apply(\WP_REST_Request $request): \WP_REST_Response {
        $config = $request->get_param('config');
        $purge  = $request->get_param('purge');
        $warm   = $request->get_param('warm');

        $results = [
            'config_applied' => false,
            'purged'         => 0,
            'warmed'         => 0,
        ];

        // Apply config
        if ($config && is_array($config)) {
            $current = get_option('silo_config', []);
            $current_version = $current['version'] ?? 0;
            $new_version     = $config['version'] ?? 0;

            if ($new_version >= $current_version) {
                update_option('silo_config', $config, false);
                $results['config_applied'] = true;
                $results['config_version'] = $new_version;

                $this->ensure_dropin();
                $this->sync_hooks($config);
            }
        }

        // Execute purge
        if ($purge && is_array($purge)) {
            $results['purged'] = silo()->page_cache()->purge_urls($purge);
        }

        // Execute warm
        if ($warm && is_array($warm)) {
            $results['warmed'] = silo()->warmup()->warm_urls($warm);
        }

        return new \WP_REST_Response($results, 200);
    }

    private function ensure_dropin(): void {
        $dropin_source = SILO_PLUGIN_DIR . 'advanced-cache.php';
        $dropin_dest   = WP_CONTENT_DIR . '/advanced-cache.php';

        if (!file_exists($dropin_dest) || !str_contains(file_get_contents($dropin_dest), 'silo-connector')) {
            if (file_exists($dropin_source)) {
                copy($dropin_source, $dropin_dest);
            }
        }
    }

    private function sync_hooks(array $config): void {
        $required = $config['hooks_required'] ?? [];
        update_option('silo_required_hooks', $required, false);
    }
}
