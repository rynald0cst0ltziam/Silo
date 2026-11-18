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
                if ($response instanceof \Requests_Response && $response->success) {
                    $warmed++;
                } elseif ($response instanceof \WpOrg\Requests\Response && $response->success) {
                    $warmed++;
                }
            }
        }

        return $warmed;
    }
}
