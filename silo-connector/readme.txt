=== Silo for WooCommerce ===
Contributors: silosystems
Tags: woocommerce, cache, page cache, store api, performance
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.1
Requires Plugins: woocommerce
WC requires at least: 8.2
WC tested up to: 9.9
Stable tag: 2.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Inventory-aware page and Store API cache for WooCommerce, with surgical invalidation and priority warmup orchestrated by Silo.

== Description ==

Silo is a cache built only for WooCommerce catalog traffic. When stock, a price or a product changes, Silo invalidates exactly the product page, its variations, the archives that list it and the Store API responses that contain it, then re-warms the pages that matter. Everything else stays warm.

This connector:

* Scans the catalog into a graph: product types, variations, stock, categories, tags, brands, attribute archives and Store API routes.
* Serves product pages, the shop page and product archives from disk before WordPress loads (advanced-cache.php drop-in).
* Caches anonymous Store API catalog responses per filter set, and invalidates only the sets that can contain a changed product.
* Listens to WooCommerce events (stock changes, order stock reductions and restores, refunds, price and sale changes, product edits, publishing, term edits, reviews) and purges on the store immediately.
* Sends each change to Silo in the background, which resolves the full scope and warmup plan.
* Warms priority pages from your own server for desktop and mobile, in parallel, through Action Scheduler.
* Never caches cart, checkout, account pages or any request carrying a WooCommerce session, cart cookie, login or Authorization header.
* Supports HPOS, Product Blocks, multilingual (WPML, Polylang, TranslatePress) and multi-currency setups.

Silo does not minify assets, optimise images, clean the database or touch anything outside WooCommerce catalog caching. Keep your existing tools for those jobs, and disable their page caching.

== Installation ==

1. In the Silo dashboard, add the store and copy its key (sk_silo_…).
2. Download the connector from the same screen, then in WordPress go to Plugins → Add New → Upload Plugin and activate it.
3. Open WooCommerce → Silo, paste the key and choose Connect & scan catalog.
4. Watch the scan map the catalog. When it completes, caching and invalidation are live and priority pages warm in the background.

== Frequently Asked Questions ==

= How do I confirm a page is cached? =

Request a product page in a private window and look for the `x-silo-cache` response header: `MISS` on the first request, `HIT` afterwards. Logged-in or carted sessions show `BYPASS`, which is the session boundary working.

= Does this replace WP Rocket, LiteSpeed or W3 Total Cache? =

For WooCommerce page caching, yes. Disable page caching in those plugins (and at your host) to avoid two caches serving the same URLs. Their asset optimisation and CDN features can stay on. If another plugin owns advanced-cache.php, Silo leaves it alone and serves from plugins_loaded instead.

= What happens on deactivation and uninstall? =

Deactivation purges cached files, removes the drop-in and the WP_CACHE line Silo added, and stops all scheduled work. Uninstall additionally deletes every option, both database tables and the cache directory.

== Changelog ==

= 2.1.0 =
* Rebuilt connector: per-URL cache addressing (every query, device, currency and language variant purged together), atomic writes, accurate hit/miss/bypass accounting.
* Live animated catalog scan in WordPress and in the Silo dashboard.
* Background, batched event dispatch with immediate on-site purge; checkout requests are never slowed down.
* Parallel desktop + mobile warmup with per-URL results reported live.
* Store API cache with a strict header whitelist and per-product invalidation.
* New admin app: overview, catalog, invalidations, warmup, status and settings.
* Complete cleanup on deactivation and uninstall.

== Credits ==

Interface typeface: Space Grotesk by Florian Karsten, licensed under the SIL Open Font License 1.1 (assets/fonts/OFL.txt).
