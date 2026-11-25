import type { TierConfig } from "@/lib/tiers";

/**
 * Catalog snapshot sent by the connector when a scan completes.
 * Fields after `existing_cache` were added in connector 2.1; all are optional for older connectors.
 */
export interface StoreSnapshot {
  url: string;
  product_count: number;
  product_types: Record<string, number>;
  variation_complexity: "high" | "low";
  stock_management: boolean;
  hpos: boolean;
  multilingual: string[];
  multi_currency: boolean;
  bestsellers: number[];
  existing_cache: string | null;

  home_url?: string;
  shop_url?: string;
  variation_count?: number;
  stock?: { managed?: number; instock?: number; outofstock?: number; onbackorder?: number };
  variation_stock?: { instock?: number; outofstock?: number; onbackorder?: number };
  hide_out_of_stock?: boolean;
  taxonomies?: Record<string, { label: string; terms: number; archives: number; public: boolean }>;
  attributes?: Array<{ taxonomy: string; label: string; terms: number; public: boolean }>;
  category_count?: number;
  tag_count?: number;
  archive_count?: number;
  store_api_routes?: string[];
  private_route_count?: number;
  language_cookie?: boolean;
  geolocation?: string;
  calc_taxes?: boolean;
  currencies?: string[];
  priority_urls?: string[];
  exclude_paths?: string[];
  conflicts?: string[];
  graph?: { nodes: number; edges: number };
  environment?: Record<string, unknown>;
  connector_version?: string;
  scanned_at?: string;
  scan_ms?: number;
}

export interface SiloConfig {
  version: number;
  tier: string;
  limits: {
    warmup_urls_per_event: number;
    max_monthly_events: number;
  };
  variants: {
    device: boolean;
    language: string[];
    language_cookie: boolean;
    country: boolean;
    currency: boolean;
    geo_tax: boolean;
    attribute_filters: boolean;
    pagination: boolean;
  };
  exclusions: string[];
  ttl: {
    product: number;
    category: number;
    shop: number;
    store_api: number;
  };
  priority_products: number[];
  priority_urls: string[];
  invalidation_rules: {
    on_product_update: string[];
    on_stock_change: string[];
    on_order: string[];
  };
  store_api: {
    enabled: boolean;
    endpoints: string[];
    vary: string[];
  };
  hooks_required: string[];
}

export function generateConfig(
  tier: TierConfig,
  snapshot: StoreSnapshot,
  currentVersion: number = 0,
): SiloConfig {
  const languages = snapshot.multilingual?.length ? snapshot.multilingual : [];
  const isMultiLang = languages.length > 1;
  const isMultiCurrency = snapshot.multi_currency ?? false;
  const isHighVariation = snapshot.variation_complexity === "high";
  const hasStockMgmt = snapshot.stock_management ?? true;
  const productCount = snapshot.product_count ?? 0;

  const ttl = computeTtl(productCount, hasStockMgmt);
  // Real permalinks from the scan. Older connectors only sent IDs; ?p= URLs redirect and cannot be cached.
  const priorityUrls = (snapshot.priority_urls ?? []).filter((u) => typeof u === "string" && u.startsWith("http"));

  const storeApiVary: string[] = [];
  if (isMultiCurrency) storeApiVary.push("currency");
  if (isMultiLang) storeApiVary.push("language");

  const exclusions = [
    "/cart",
    "/checkout",
    "/my-account",
    ...(snapshot.exclude_paths ?? []),
    "query:add-to-cart",
    "query:wc-ajax",
    "session:woocommerce",
    "logged_in",
  ];

  return {
    version: currentVersion + 1,
    tier: tier.slug,
    limits: {
      warmup_urls_per_event: tier.warmupUrlsPerEvent,
      max_monthly_events: tier.maxMonthlyEvents,
    },
    variants: {
      device: true,
      language: languages,
      language_cookie: Boolean(snapshot.language_cookie) && isMultiLang,
      // "Geolocate" (without page-caching support) renders prices per visitor country.
      country: snapshot.geolocation === "geolocation" && Boolean(snapshot.calc_taxes),
      currency: isMultiCurrency,
      geo_tax: isMultiCurrency,
      attribute_filters: isHighVariation,
      pagination: true,
    },
    exclusions: [...new Set(exclusions)],
    ttl,
    priority_products: snapshot.bestsellers ?? [],
    // Keep the full priority list (largest plan's cap); each use slices it to the current plan,
    // so an upgrade takes effect immediately without a rescan.
    priority_urls: priorityUrls.slice(0, 2000),
    invalidation_rules: buildInvalidationRules(isHighVariation, hasStockMgmt),
    store_api: {
      enabled: true,
      endpoints: snapshot.store_api_routes?.length
        ? snapshot.store_api_routes
        : ["/wc/store/v1/products", "/wc/store/v1/products/collection-data"],
      vary: storeApiVary,
    },
    hooks_required: [
      "woocommerce_product_object_updated_props",
      "woocommerce_product_set_stock",
      "woocommerce_variation_set_stock",
      "woocommerce_product_set_stock_status",
      "woocommerce_reduce_order_stock",
      "woocommerce_restore_order_stock",
      "woocommerce_order_refunded",
      "woocommerce_new_product",
      "edited_term",
      "set_object_terms",
    ],
  };
}

function computeTtl(productCount: number, hasStockMgmt: boolean): SiloConfig["ttl"] {
  // Event-driven invalidation keeps entries correct; TTL is only the safety net.
  const productBase = hasStockMgmt ? 3600 : 7200;
  if (productCount > 10000) {
    return { product: productBase * 2, category: 3600, shop: 3600, store_api: 600 };
  }
  if (productCount > 1000) {
    return { product: productBase, category: 1800, shop: 1800, store_api: 300 };
  }
  return { product: productBase, category: 1800, shop: 1800, store_api: 300 };
}

function buildInvalidationRules(isHighVariation: boolean, hasStockMgmt: boolean): SiloConfig["invalidation_rules"] {
  const onProductUpdate = ["product_url", "grouped_parents", "store_api_products"];
  const onStockChange = ["product_url", "categories", "tags", "attributes", "shop", "store_api_collections"];
  const onOrder = ["affected_products", "categories", "shop", "store_api_collections"];

  if (isHighVariation) {
    onStockChange.push("variation_nodes", "parent_product");
  }
  if (!hasStockMgmt) {
    onStockChange.splice(onStockChange.indexOf("store_api_collections"), 1, "store_api_products");
  }

  return {
    on_product_update: onProductUpdate,
    on_stock_change: onStockChange,
    on_order: onOrder,
  };
}

/**
 * Another full-page cache is not a conflict: the connector switches to "work alongside"
 * mode, leaves page serving to that plugin and purges/warms the exact URLs in it.
 * Only Mamba overlaps completely (same job, same hooks), so it is the one worth flagging.
 */
export function detectCacheConflicts(existingCache: string | null): {
  hasConflict: boolean;
  plugin: string | null;
  instructions: string | null;
} {
  if (!existingCache) return { hasConflict: false, plugin: null, instructions: null };
  if (existingCache === "mamba-cache") {
    return {
      hasConflict: true,
      plugin: existingCache,
      instructions: "Mamba Cache does the same WooCommerce invalidation job as Silo. Deactivate one of them so changes are not handled twice.",
    };
  }
  return { hasConflict: false, plugin: existingCache, instructions: null };
}
