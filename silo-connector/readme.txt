=== Silo — WooCommerce Cache Connector ===
Contributors: silosystems
Tags: cache, woocommerce, performance, invalidation, inventory
Requires at least: 6.4
Tested up to: 6.7
Requires PHP: 8.1
WC requires at least: 8.2
WC tested up to: 9.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Connects your WooCommerce store to Silo for inventory-aware surgical cache invalidation.

== Description ==

Silo is the only cache built specifically for WooCommerce. When a stock level changes, Silo knows exactly which product page, category archive, variation payload, and Store API response to invalidate — then re-warms the pages that matter.

This connector plugin:

* Serves cached pages from disk with sub-millisecond lookups
* Reports WooCommerce events (stock changes, orders, product updates) to the Silo SaaS
* Receives and applies cache configuration from your Silo dashboard
* Executes targeted purge and warmup instructions
* Never caches cart, checkout, or account pages
* Supports HPOS, Product Blocks, Store API, multilingual, and multi-currency setups

== Installation ==

1. Upload the `silo-connector` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu
3. Go to WooCommerce → Silo Cache
4. Paste your API key from your Silo dashboard
5. The connector will handshake with Silo and begin caching

== Frequently Asked Questions ==

= Does this replace WP Rocket / LiteSpeed / W3 Total Cache? =

For page caching, yes. Silo's page cache is purpose-built for WooCommerce and understands inventory. You should disable page caching in other plugins to avoid conflicts. Other features (minification, CDN, etc.) can remain active.

= Does this work with HPOS? =

Yes. Silo detects HPOS automatically and uses the correct order tables.

= What about variable products? =

Silo tracks each variation independently. When one variation's stock changes, only the affected pages are invalidated — not the entire catalog.

== Changelog ==

= 1.0.0 =
* Initial release
* Page cache with disk-based serving via advanced-cache.php drop-in
* WooCommerce event reporting (stock, orders, products, variations, sales)
* Config apply endpoint for SaaS-pushed configuration
* Concurrent warmup with tier-based URL limits
* Admin settings page under WooCommerce menu
* HMAC-SHA256 request signing
* HPOS, multilingual, and multi-currency detection
