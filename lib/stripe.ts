import Stripe from "stripe";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    apiVersion: "2026-11-18.endive",
    typescript: true,
  });
}

let _stripe: Stripe | undefined;
export function getStripe() {
  if (!_stripe) _stripe = getStripeClient();
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export type PriceMap = {
  solo_monthly: string;
  solo_annual: string;
  studio_monthly: string;
  studio_annual: string;
  portfolio_monthly: string;
  portfolio_annual: string;
};

export const STRIPE_PRICES: PriceMap = {
  solo_monthly: process.env.STRIPE_PRICE_SOLO_MONTHLY ?? "",
  solo_annual: process.env.STRIPE_PRICE_SOLO_ANNUAL ?? "",
  studio_monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY ?? "",
  studio_annual: process.env.STRIPE_PRICE_STUDIO_ANNUAL ?? "",
  portfolio_monthly: process.env.STRIPE_PRICE_PORTFOLIO_MONTHLY ?? "",
  portfolio_annual: process.env.STRIPE_PRICE_PORTFOLIO_ANNUAL ?? "",
};

export function priceIdToTier(priceId: string): { tier: string; interval: string } | null {
  for (const [key, value] of Object.entries(STRIPE_PRICES)) {
    if (value && value === priceId) {
      const [tier, interval] = key.split("_");
      return { tier, interval };
    }
  }
  return null;
}

type PriceLike = { id?: string; lookup_key?: string | null; metadata?: Record<string, string> | null; recurring?: { interval?: string } | null };

/**
 * Silo plan for a Stripe price, or null when the price belongs to another product on the
 * same Stripe account. Prices created for Silo carry metadata app=silo and a lookup key
 * silo_{tier}_{monthly|annual}; env price IDs are still honoured.
 */
export function tierFromPrice(price: PriceLike | null | undefined): { tier: string; interval: "month" | "year" } | null {
  if (!price) return null;
  const meta = price.metadata ?? {};
  if (meta.app === "silo" && meta.tier) {
    return { tier: meta.tier, interval: price.recurring?.interval === "year" ? "year" : "month" };
  }
  const key = price.lookup_key ?? "";
  const m = /^silo_(solo|studio|portfolio)_(monthly|annual)$/.exec(key);
  if (m) return { tier: m[1], interval: m[2] === "annual" ? "year" : "month" };
  const env = price.id ? priceIdToTier(price.id) : null;
  return env ? { tier: env.tier, interval: env.interval === "annual" ? "year" : "month" } : null;
}

const priceCache = new Map<string, { id: string; at: number }>();

/** Price ID for a plan: env override first, then the Stripe lookup key (cached 10 minutes). */
export async function siloPriceId(tier: string, interval: "month" | "year"): Promise<string | null> {
  const envKey = `${tier}_${interval === "month" ? "monthly" : "annual"}` as keyof PriceMap;
  if (STRIPE_PRICES[envKey]) return STRIPE_PRICES[envKey];
  const lookup = `silo_${envKey}`;
  const cached = priceCache.get(lookup);
  if (cached && Date.now() - cached.at < 600_000) return cached.id;
  const list = await getStripe().prices.list({ lookup_keys: [lookup], active: true, limit: 1 });
  const id = list.data[0]?.id ?? null;
  if (id) priceCache.set(lookup, { id, at: Date.now() });
  return id;
}

let portalConfig: { id: string | undefined; at: number } | null = null;

/** Silo's billing portal configuration (the account is shared, so never the default one). */
export async function siloPortalConfiguration(): Promise<string | undefined> {
  if (process.env.STRIPE_PORTAL_CONFIGURATION) return process.env.STRIPE_PORTAL_CONFIGURATION;
  if (portalConfig && Date.now() - portalConfig.at < 600_000) return portalConfig.id;
  const list = await getStripe().billingPortal.configurations.list({ active: true, limit: 50 });
  const id = list.data.find((c) => c.metadata?.app === "silo")?.id;
  portalConfig = { id, at: Date.now() };
  return id;
}
