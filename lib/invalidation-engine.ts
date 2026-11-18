import type { SiloConfig, StoreSnapshot } from "@/lib/config-engine";

export interface EventPayload {
  product_id?: number;
  product_type?: string;
  name?: string;
  url?: string;
  categories?: string[];
  parent_id?: number;
  variation_id?: number;
  sku?: string;
  stock_quantity?: number | null;
  stock_status?: string;
  managing_stock?: boolean;
  updated_props?: string[];
  order_id?: number;
  from?: string;
  to?: string;
  products?: Array<{
    product_id: number;
    variation_id?: number | null;
    quantity: number;
    url: string;
    categories: string[];
  }>;
  type?: string; // for sale_boundary
  product_urls?: string[];
}

export interface InvalidationResult {
  purge: string[];
  warm: string[];
}

export function resolveInvalidation(
  eventType: string,
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): InvalidationResult {
  const rawUrls = resolveAffectedUrls(eventType, payload, config, storeUrl);
  const expanded = expandVariants(rawUrls, config, storeUrl);
  const purge = [...new Set(expanded)];
  const warm = purge.slice(0, config.limits.warmup_urls_per_event);

  return { purge, warm };
}

function resolveAffectedUrls(
  eventType: string,
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  switch (eventType) {
    case "product_updated":
      return resolveProductUpdate(payload, config, storeUrl);
    case "variation_created":
      return resolveVariationChange(payload, config, storeUrl);
    case "stock_changed":
      return resolveStockChange(payload, config, storeUrl);
    case "order_status_changed":
      return resolveOrder(payload, config, storeUrl);
    case "product_props_updated":
      return resolveProductPropsUpdate(payload, config, storeUrl);
    case "sale_boundary":
      return resolveSaleBoundary(payload, config, storeUrl);
    default:
      return payload.url ? [payload.url] : [];
  }
}

function resolveProductUpdate(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  if (payload.url) urls.push(payload.url);
  if (payload.categories) urls.push(...payload.categories);

  urls.push(...getShopVariants(storeUrl));

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  if (
    config.variants.attribute_filters &&
    payload.product_type === "variable"
  ) {
    if (payload.url) {
      urls.push(...getVariationUrls(payload.url));
    }
  }

  return urls;
}

function resolveVariationChange(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  if (payload.url) urls.push(payload.url);

  if (payload.parent_id) {
    urls.push(`${storeUrl}/?p=${payload.parent_id}`);
  }

  urls.push(...getShopVariants(storeUrl));

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  return urls;
}

function resolveStockChange(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  if (payload.url) urls.push(payload.url);
  if (payload.categories) urls.push(...payload.categories);

  urls.push(...getShopVariants(storeUrl));

  if (payload.parent_id && payload.parent_id !== payload.product_id) {
    urls.push(`${storeUrl}/?p=${payload.parent_id}`);
  }

  if (config.variants.attribute_filters && payload.product_type === "variation") {
    if (payload.url) {
      urls.push(...getVariationUrls(payload.url));
    }
  }

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  return urls;
}

function resolveOrder(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  if (payload.products) {
    for (const product of payload.products) {
      if (product.url) urls.push(product.url);
      if (product.categories) urls.push(...product.categories);
    }
  }

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  return urls;
}

function resolveProductPropsUpdate(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  if (payload.url) urls.push(payload.url);
  if (payload.categories) urls.push(...payload.categories);

  const priceProps = ["regular_price", "sale_price", "date_on_sale_from", "date_on_sale_to"];
  const hasPriceChange = payload.updated_props?.some((p) => priceProps.includes(p));

  if (hasPriceChange) {
    urls.push(...getShopVariants(storeUrl));
  }

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  return urls;
}

function resolveSaleBoundary(
  payload: EventPayload,
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const urls: string[] = [];

  urls.push(...getShopVariants(storeUrl));

  if (payload.product_urls) {
    urls.push(...payload.product_urls);
  }

  if (config.store_api.enabled) {
    urls.push(...getStoreApiUrls(storeUrl, config));
  }

  return urls;
}

function getShopVariants(storeUrl: string): string[] {
  const shop = `${storeUrl}/shop/`;
  return [
    shop,
    `${shop}?orderby=price`,
    `${shop}?orderby=price-desc`,
    `${shop}?orderby=date`,
    `${shop}?orderby=popularity`,
    `${shop}?orderby=rating`,
  ];
}

function getVariationUrls(productUrl: string): string[] {
  return [
    `${productUrl}?attribute_filter=1`,
  ];
}

function getStoreApiUrls(storeUrl: string, config: SiloConfig): string[] {
  return config.store_api.endpoints.map(
    (endpoint) => `${storeUrl}/wp-json${endpoint}`,
  );
}

function expandVariants(
  urls: string[],
  config: SiloConfig,
  storeUrl: string,
): string[] {
  const expanded: string[] = [];

  for (const url of urls) {
    expanded.push(url);

    if (config.variants.device && isPageUrl(url, storeUrl)) {
      expanded.push(addParam(url, "device", "mobile"));
    }

    if (config.variants.language.length > 1) {
      for (const lang of config.variants.language) {
        if (lang === config.variants.language[0]) continue;
        expanded.push(addParam(url, "lang", lang));
      }
    }

    if (config.variants.currency) {
      expanded.push(addParam(url, "currency", "alt"));
    }
  }

  return expanded;
}

function isPageUrl(url: string, storeUrl: string): boolean {
  return url.startsWith(storeUrl) && !url.includes("/wp-json/");
}

function addParam(url: string, key: string, value: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${key}=${value}`;
}
