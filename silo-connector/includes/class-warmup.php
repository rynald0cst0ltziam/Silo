<?php
/**
 * Warmup: requests URLs to populate the cache.
 * Uses non-blocking concurrent requests within concurrency limits.
 *
 * @package silo-connector
 */

defined('ABSPATH') || exit;

class Silo_Warmup {

    private int $concurrency = 5;
    private int $timeout = 15;

    public function warm_urls(array $urls): int {
        if (empty($urls)) {
            return 0;
        }

        if (get_option('silo_warmup_enabled', '1') !== '1') {
            return 0;
        }

        $config = get_option('silo_config', []);
        $limit  = $config['limits']['warmup_urls_per_event'] ?? 50;
        $urls   = array_slice($urls, 0, $limit);

        $warmed = 0;
        $chunks = array_chunk($urls, $this->concurrency);

        foreach ($chunks as $chunk) {
            $requests = [];

            foreach ($chunk as $url) {
                $requests[$url] = [
                    'url'     => $url,
                    'type'    => 'GET',
                    'headers' => [
                        'User-Agent'    => 'Silo-Warmup/' . SILO_VERSION,
                        'X-Silo-Warmup' => '1',
                    ],
                ];
            }

            $responses = \Requests::request_multiple($requests, [
                'timeout'         => $this->timeout,
                'connect_timeout' => 5,
            ]);

            foreach ($responses as $url => $response) {
                $ok = false;
                if ($response instanceof \Requests_Response && $response->success) {
                    $ok = true;
                } elseif ($response instanceof \WpOrg\Requests\Response && $response->success) {
                    $ok = true;
                }
                if ($ok) {
                    $warmed++;
                }
                $this->log_warmup($url, $ok ? 'ok' : 'failed');
            }
        }

        return $warmed;
    }

    private function log_warmup(string $url, string $status): void {
        $log_file = SILO_CACHE_DIR . '.warmup.log';
        $line = gmdate('Y-m-d H:i:s') . '|' . $url . '|' . $status . "\n";
        file_put_contents($log_file, $line, FILE_APPEND | LOCK_EX);

        if (rand(1, 20) === 1 && file_exists($log_file)) {
            $lines = file($log_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines && count($lines) > 500) {
                $lines = array_slice($lines, -500);
                file_put_contents($log_file, implode("\n", $lines) . "\n", LOCK_EX);
            }
        }
    }
}
