import type { SiloConfig, StoreSnapshot } from "@/lib/config-engine";

/**
 * URLs the connector resolved for a product at the moment of the change.
 * The connector purges every query/device/currency/language variant of each URL path
 * (and its /page/N children), so Silo never has to enumerate variants.
 */
export type ProductUrls = {
  product?: string;
  categories?: string[];
  tags?: string[];
  brands?: string[];
  attributes?: string[];
  grouped_parents?: string[];
  /** Product Bundles that contain this product (their page shows its stock). */
  bundles?: string[];
  /** Extra pages: bundle categories, pages listed in the connector settings, the silo_extra_urls filter. */
  extra?: string[];
  shop?: string;
  home?: string;
  previous?: string[];
  terms?: string[];
};

export type ProductDescription = {
  product_id?: number;
  name?: string;
  sku?: string;
  product_type?: string;
  status?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  variations?: Array<{ id: number; label?: string; sku?: string; stock_status?: string; stock_quantity?: number | null }>;
  urls?: ProductUrls;
  qty?: number;
};

export type EventPayload = ProductDescription & {
  items?: ProductDescription[];
  store_api?: { mode?: string; product_ids?: number[] };
  order_id?: number;
  order_number?: string;
  term_id?: number;
  taxonomy?: string;
  // Legacy connector fields.
  url?: string;
  categories?: string[];
  products?: Array<{ url?: string; categories?: string[] }>;
  product_urls?: string[];
};

export interface InvalidationResult {
  purge: string[];
  warm: string[];
  store_api: { mode: "products" | "collections" | "all"; product_ids: number[] };
  scope: { products: number; archives: number; pages: number; full: boolean };
}

const MEMBERSHIP_EVENTS = new Set([
  "stock.changed",
  "price.updated",
  "sale.boundary",
  "product.created",
  "product.deleted",
  "product.visibility",
  "order.stock_reduced",
  "order.stock_restored",
  "order.refunded",
  "term.updated",
  "term.deleted",
]);

const FULL_PURGE_EVENTS = new Set(["purge.all", "system.settings", "system.theme", "system.upgrade"]);

/**
 * Silo's graph walk: from one catalog fact to the exact set of responses to clear,
 * then a priority-ordered warmup plan capped by the plan's per-event limit.
 */
export function resolveInvalidation(
  eventType: string,
  payload: EventPayload,
  config: SiloConfig | null,
  storeUrl: string,
  snapshot: Partial<StoreSnapshot> | null,
  warmCap: number,
): InvalidationResult {
  const origin = safeOrigin(storeUrl);
  const priority = new Set((config?.priority_urls ?? snapshot?.priority_urls ?? []).map(normalize));

  if (FULL_PURGE_EVENTS.has(eventType)) {
    const warm = (config?.priority_urls ?? snapshot?.priority_urls ?? []).filter((u) => sameOrigin(u, origin)).slice(0, warmCap);
    return {
      purge: [],
      warm,
      store_api: { mode: "all", product_ids: [] },
      scope: { products: snapshot?.product_count ?? 0, archives: snapshot?.archive_count ?? 0, pages: 0, full: true },
    };
  }

  const descriptions: ProductDescription[] = payload.items?.length ? payload.items : [payload];
  const membership = MEMBERSHIP_EVENTS.has(eventType);
  const deleted = eventType === "product.deleted";

  const productPages: string[] = [];
  const archivePages: string[] = [];
  const warmProducts: string[] = [];
  const warmArchives: string[] = [];

  for (const d of descriptions) {
    const urls = d.urls ?? legacyUrls(payload);
    const product = urls.product ? [urls.product] : [];

    productPages.push(...product, ...(urls.grouped_parents ?? []), ...(urls.bundles ?? []), ...(urls.previous ?? []));
    if (!deleted) warmProducts.push(...product, ...(urls.grouped_parents ?? []), ...(urls.bundles ?? []));

    if (membership || eventType === "product.updated" && (urls.previous?.length ?? 0) > 0) {
      const archives = [
        ...(urls.categories ?? []),
        ...(urls.tags ?? []),
        ...(urls.brands ?? []),
        ...(urls.attributes ?? []),
        ...(urls.terms ?? []),
        ...(urls.extra ?? []),
        ...(urls.shop ? [urls.shop] : []),
        ...(urls.home ? [urls.home] : []),
      ];
      archivePages.push(...archives);
      warmArchives.push(
        ...(urls.shop ? [urls.shop] : []),
        ...(urls.categories ?? []),
        ...(urls.brands ?? []),
        ...(urls.tags ?? []),
        ...(urls.attributes ?? []),
        ...(eventType === "term.deleted" ? [] : urls.terms ?? []),
        ...(urls.extra ?? []),
        ...(urls.home ? [urls.home] : []),
      );
    }
  }

  const purge = unique([...productPages, ...archivePages]).filter((u) => sameOrigin(u, origin));

  // Warm order: products (bestsellers first), then the shop and archives in catalog order.
  const products = unique(warmProducts).filter((u) => sameOrigin(u, origin));
  products.sort((a, b) => Number(priority.has(normalize(b))) - Number(priority.has(normalize(a))));
  const warm = unique([...products, ...warmArchives])
    .filter((u) => sameOrigin(u, origin) && purge.includes(u))
    .slice(0, warmCap);

  const ids = new Set<number>(payload.store_api?.product_ids ?? []);
  for (const d of descriptions) {
    if (d.product_id) ids.add(d.product_id);
    for (const v of d.variations ?? []) ids.add(v.id);
  }

  return {
    purge,
    warm,
    store_api: { mode: membership ? "collections" : "products", product_ids: [...ids] },
    scope: {
      products: descriptions.length,
      archives: unique(archivePages).length,
      pages: purge.length,
      full: false,
    },
  };
}

function legacyUrls(payload: EventPayload): ProductUrls {
  const urls: ProductUrls = { categories: payload.categories ?? [] };
  if (payload.url) urls.product = payload.url;
  if (payload.product_urls) urls.previous = payload.product_urls;
  if (payload.products) {
    urls.previous = [...(urls.previous ?? []), ...payload.products.flatMap((p) => (p.url ? [p.url] : []))];
    urls.categories = [...(urls.categories ?? []), ...payload.products.flatMap((p) => p.categories ?? [])];
  }
  return urls;
}

function unique(list: string[]): string[] {
  return [...new Set(list.filter((u) => typeof u === "string" && u.length > 0))];
}

function normalize(url: string): string {
  return url.replace(/\/+$/, "").toLowerCase();
}

function safeOrigin(url: string): string {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

function sameOrigin(url: string, host: string): boolean {
  if (!host) return true;
  try {
    return new URL(url).host.toLowerCase() === host;
  } catch {
    return false;
  }
}
