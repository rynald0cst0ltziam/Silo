import type { TierConfig } from "@/lib/tiers";

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
  const languages = snapshot.multilingual?.length ? snapshot.multilingual : ["en"];
  const isMultiLang = languages.length > 1;
  const isMultiCurrency = snapshot.multi_currency ?? false;
  const isHighVariation = snapshot.variation_complexity === "high";
  const hasStockMgmt = snapshot.stock_management ?? true;
  const productCount = snapshot.product_count ?? 0;

  const ttl = computeTtl(productCount, hasStockMgmt);
  const priorityUrls = snapshot.bestsellers?.length
    ? snapshot.bestsellers.map((id) => `${snapshot.url}/?p=${id}`)
    : [];

  const storeApiVary: string[] = [];
  if (isMultiCurrency) storeApiVary.push("currency");
  if (isMultiLang) storeApiVary.push("language");

  const invalidationRules = buildInvalidationRules(isHighVariation, hasStockMgmt);

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
      currency: isMultiCurrency,
      geo_tax: isMultiCurrency,
      attribute_filters: isHighVariation,
      pagination: true,
    },
    exclusions: [
      "/cart",
      "/checkout",
      "/my-account",
      "/wp-admin",
      "query:add-to-cart",
      "query:removed_item",
      "logged_in_with_cart",
    ],
    ttl,
    priority_products: snapshot.bestsellers ?? [],
    priority_urls: priorityUrls.slice(0, tier.warmupUrlsPerEvent),
    invalidation_rules: invalidationRules,
    store_api: {
      enabled: true,
      endpoints: ["/wc/store/v1/products", "/wc/store/v1/cart"],
      vary: storeApiVary,
    },
    hooks_required: [
      "woocommerce_product_object_updated_props",
      "woocommerce_product_set_stock",
      "woocommerce_variation_set_stock",
      "woocommerce_order_status_changed",
      "woocommerce_update_product",
      "woocommerce_new_product_variation",
    ],
  };
}

function computeTtl(
  productCount: number,
  hasStockMgmt: boolean,
): SiloConfig["ttl"] {
  // Larger catalogs get longer TTLs (fewer invalidations per product)
  // Stores with stock management get shorter product TTLs (stock changes more often)
  const productBase = hasStockMgmt ? 3600 : 7200;
  const categoryBase = 1800;
  const shopBase = 1800;

  if (productCount > 10000) {
    return {
      product: productBase,
      category: categoryBase * 2,
      shop: shopBase * 2,
      store_api: 600,
    };
  }

  if (productCount > 1000) {
    return {
      product: productBase,
      category: categoryBase,
      shop: shopBase,
      store_api: 300,
    };
  }

  // Small catalogs: shorter TTLs, more aggressive warming
  return {
    product: Math.round(productBase * 0.75),
    category: Math.round(categoryBase * 0.75),
    shop: Math.round(shopBase * 0.75),
    store_api: 180,
  };
}

function buildInvalidationRules(
  isHighVariation: boolean,
  hasStockMgmt: boolean,
): SiloConfig["invalidation_rules"] {
  const onProductUpdate = [
    "product_url",
    "categories",
    "tags",
    "shop_variants",
    "store_api_products",
  ];

  const onStockChange = [
    "product_url",
    "categories",
    "shop_variants",
  ];

  const onOrder = [
    "affected_products",
    "categories",
  ];

  if (isHighVariation) {
    onProductUpdate.push("variation_urls");
    onStockChange.push("variation_urls", "parent_product");
  }

  if (hasStockMgmt) {
    onStockChange.push("store_api_products");
    onOrder.push("store_api_products");
  }

  return {
    on_product_update: onProductUpdate,
    on_stock_change: onStockChange,
    on_order: onOrder,
  };
}

export function detectCacheConflicts(existingCache: string | null): {
  hasConflict: boolean;
  plugin: string | null;
  instructions: string | null;
} {
  if (!existingCache) return { hasConflict: false, plugin: null, instructions: null };

  const instructions: Record<string, string> = {
    "wp-rocket": "Disable page caching in WP Rocket (Settings → Cache → Enable caching: uncheck). Keep minification and CDN features.",
    "w3-total-cache": "Disable Page Cache in W3 Total Cache (Performance → Page Cache → Enable: uncheck). Browser and object caching can remain.",
    "litespeed-cache": "Disable page cache in LiteSpeed Cache (LiteSpeed Cache → Cache → Enable Cache: Off). Keep image optimization.",
    "wp-fastest-cache": "Delete cache and deactivate WP Fastest Cache page caching. Or set to cache timeout 0.",
    "wp-optimize": "Disable page caching in WP-Optimize (WP-Optimize → Cache → Enable page caching: uncheck).",
  };

  return {
    hasConflict: true,
    plugin: existingCache,
    instructions: instructions[existingCache] ?? `Disable page caching in ${existingCache} to avoid conflicts with Silo.`,
  };
}
