<?php
/**
 * Cart fragments for guests with an empty cart.
 *
 * Classic themes call ?wc-ajax=get_refreshed_fragments on every page view. For a
 * visitor without a cart the response is identical for everyone (per currency and
 * language), so it is served from disk instead of booting the cart each time.
 * Any visitor with a session, cart or login always gets the live response.
 *
 * @package silo-connector
 */

defined( 'ABSPATH' ) || exit;

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.ValidatedSanitizedInput

/**
 * Empty-cart fragment cache.
 */
class Silo_Fragments {

	const TTL = 3600;

	public static function init(): void {
		add_action( 'wc_ajax_get_refreshed_fragments', array( __CLASS__, 'maybe_serve' ), 1 );
	}

	/**
	 * Cache file for this visitor, or null when the visitor may have a personal cart.
	 */
	private static function file(): ?string {
		if ( '' !== silo_session_bypass_reason( $_COOKIE, $_SERVER ) ) {
			return null;
		}
		$site   = Silo_Settings::site_dir();
		$config = silo_load_site_config( $site );
		if ( ! $config || empty( $config['enabled'] ) ) {
			return null;
		}
		$variants = (array) ( $config['variants'] ?? array() );
		$currency = ! empty( $variants['currency'] ) ? silo_request_currency( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$language = ! empty( $variants['language_cookie'] ) ? silo_request_language( $_GET, $_COOKIE ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$country  = ! empty( $variants['country'] ) ? (string) silo_request_country( $_SERVER ) : '';
		return $site . 'fragments/' . md5( $currency . '|' . $language . '|' . $country . '|' . silo_request_scheme( $_SERVER ) . '|' . get_stylesheet() ) . '.json';
	}

	public static function maybe_serve(): void {
		$file = self::file();
		if ( null === $file ) {
			return;
		}

		if ( is_file( $file ) && ( time() - (int) filemtime( $file ) ) < self::TTL ) {
			$body = (string) file_get_contents( $file );
			if ( '' !== $body ) {
				Silo_Stats::bump( array( 'fragment_hits' => 1 ) );
				nocache_headers();
				header( 'Content-Type: application/json; charset=' . get_option( 'blog_charset', 'UTF-8' ) );
				header( 'X-Silo-Cache: HIT' );
				echo $body; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Stored WooCommerce JSON response.
				exit;
			}
		}

		ob_start(
			static function ( $buffer, $phase ) use ( $file ) {
				if ( ! ( $phase & PHP_OUTPUT_HANDLER_FINAL ) || ( $phase & PHP_OUTPUT_HANDLER_CLEAN ) ) {
					return $buffer;
				}
				$decoded = json_decode( (string) $buffer, true );
				$empty   = function_exists( 'WC' ) && WC()->cart && WC()->cart->is_empty();
				$cookie  = false;
				foreach ( headers_list() as $header ) {
					if ( 0 === stripos( $header, 'set-cookie:' ) ) {
						$cookie = true;
					}
				}
				if ( $empty && ! $cookie && is_array( $decoded ) && isset( $decoded['fragments'] ) && wp_mkdir_p( dirname( $file ) ) ) {
					file_put_contents( $file, (string) $buffer, LOCK_EX );
					Silo_Stats::bump( array( 'fragment_misses' => 1 ) );
				}
				return $buffer;
			}
		);
	}

	public static function flush(): void {
		$dir = Silo_Settings::site_dir() . 'fragments/';
		if ( is_dir( $dir ) ) {
			foreach ( (array) glob( $dir . '*.json' ) as $file ) {
				if ( is_string( $file ) ) {
					wp_delete_file( $file );
				}
			}
		}
	}
}
