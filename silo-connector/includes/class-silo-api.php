<?php
/**
 * Signed communication with the Silo service, and verification of signed inbound calls.
 *
 * Every request carries X-Silo-Key-Id (sha256 of the store key), a timestamp and an
 * HMAC-SHA256 of "{timestamp}.{body}". The key itself never travels over the wire.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * Thin client for the Silo API.
 */
class Silo_Api {

	/**
	 * Request headers for a body signed with the given key.
	 *
	 * @param string      $body Body.
	 * @param string|null $key Key.
	 */
	public static function headers( string $body, ?string $key = null ): array {
		$key       = $key ?? Silo_Settings::api_key();
		$timestamp = (string) time();

		return array(
			'Content-Type'     => 'application/json',
			'Accept'           => 'application/json',
			'X-Silo-Key-Id'    => hash( 'sha256', $key ),
			'X-Silo-Timestamp' => $timestamp,
			'X-Silo-Signature' => hash_hmac( 'sha256', $timestamp . '.' . $body, $key ),
			'X-Silo-Connector' => SILO_VERSION,
		);
	}

	/**
	 * POST JSON to the Silo API.
	 *
	 * @param string      $path Path.
	 * @param array       $data Data.
	 * @param int         $timeout Timeout.
	 * @param bool        $blocking Blocking.
	 * @param string|null $key Key.
	 * @param string|null $base Base.
	 * @return array{code:int,body:array,ms:int}|WP_Error
	 */
	public static function post( string $path, array $data, int $timeout = 15, bool $blocking = true, ?string $key = null, ?string $base = null ) {
		$base = $base ?? Silo_Settings::saas_url();
		if ( '' === $base ) {
			return new WP_Error( 'silo_no_saas', __( 'Silo service URL is not configured.', 'silo-connector' ) );
		}

		$body    = (string) wp_json_encode( $data );
		$started = microtime( true );

		$response = wp_remote_post(
			$base . $path,
			array(
				'timeout'    => $timeout,
				'blocking'   => $blocking,
				'headers'    => self::headers( $body, $key ),
				'body'       => $body,
				'user-agent' => 'SiloConnector/' . SILO_VERSION . '; ' . home_url( '/' ),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}
		if ( ! $blocking ) {
			return array(
				'code' => 0,
				'body' => array(),
				'ms'   => 0,
			);
		}

		$decoded = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		return array(
			'code' => (int) wp_remote_retrieve_response_code( $response ),
			'body' => is_array( $decoded ) ? $decoded : array(),
			'ms'   => (int) round( ( microtime( true ) - $started ) * 1000 ),
		);
	}

	/**
	 * Human-readable reason for a failed call.
	 *
	 * @param array|WP_Error $response Result of post().
	 */
	public static function error_message( $response ): string {
		if ( is_wp_error( $response ) ) {
			return $response->get_error_message();
		}
		$code   = (int) ( $response['code'] ?? 0 );
		$reason = (string) ( $response['body']['error'] ?? '' );

		if ( 401 === $code ) {
			return '' !== $reason ? $reason : __( 'Silo rejected the store key. Copy it again from your Silo dashboard.', 'silo-connector' );
		}
		if ( 429 === $code ) {
			return '' !== $reason ? $reason : __( 'Monthly event limit reached for this plan.', 'silo-connector' );
		}
		/* translators: %d: HTTP status code */
		return '' !== $reason ? $reason : sprintf( __( 'Silo responded with HTTP %d.', 'silo-connector' ), $code );
	}

	/**
	 * Verify a signed request from Silo (permission callback for inbound REST routes).
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function verify( WP_REST_Request $request ): bool {
		$key = Silo_Settings::api_key();
		if ( '' === $key ) {
			return false;
		}

		$signature = (string) $request->get_header( 'x_silo_signature' );
		$timestamp = (string) $request->get_header( 'x_silo_timestamp' );
		if ( '' === $signature || '' === $timestamp || abs( time() - (int) $timestamp ) > 300 ) {
			return false;
		}

		$v2 = (string) $request->get_header( 'x_silo_signature_v2' );
		if ( '' !== $v2 ) {
			// Bound to method and route: a signature for one endpoint is useless on another.
			$signature = $v2;
			$expected  = hash_hmac( 'sha256', $timestamp . '.' . $request->get_method() . ' ' . $request->get_route() . '.' . $request->get_body(), $key );
			if ( ! get_option( 'silo_sig_v2' ) ) {
				update_option( 'silo_sig_v2', 1, false );
			}
		} elseif ( get_option( 'silo_sig_v2' ) ) {
			return false; // Silo signs with v2 now; a v1-only request is a downgrade attempt.
		} else {
			$expected = hash_hmac( 'sha256', $timestamp . '.' . $request->get_body(), $key );
		}
		if ( ! hash_equals( $expected, $signature ) ) {
			return false;
		}

		// Each signature is accepted once: a captured request cannot be replayed inside the window.
		$seen = 'silo_sig_' . substr( $signature, 0, 40 );
		if ( get_transient( $seen ) ) {
			return false;
		}
		set_transient( $seen, 1, 330 );
		return true;
	}
}
