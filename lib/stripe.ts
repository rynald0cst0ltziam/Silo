import Stripe from "stripe";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key, {
    apiVersion: "2026-10-28.endive",
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
    if (value === priceId) {
      const [tier, interval] = key.split("_");
      return { tier, interval };
    }
  }
  return null;
}
