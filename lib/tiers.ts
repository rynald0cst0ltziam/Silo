export type TierSlug = "solo" | "studio" | "portfolio";

export type TierConfig = {
  slug: TierSlug;
  name: string;
  maxStores: number;
  maxMonthlyEvents: number;
  warmupUrlsPerEvent: number;
  logRetentionDays: number;
  priceMonthly: number;
  priceAnnual: number;
};

export const TIERS: Record<TierSlug, TierConfig> = {
  solo: {
    slug: "solo",
    name: "Solo",
    maxStores: 1,
    maxMonthlyEvents: 100_000,
    warmupUrlsPerEvent: 50,
    logRetentionDays: 30,
    priceMonthly: 29,
    priceAnnual: 290,
  },
  studio: {
    slug: "studio",
    name: "Studio",
    maxStores: 3,
    maxMonthlyEvents: 500_000,
    warmupUrlsPerEvent: 250,
    logRetentionDays: 90,
    priceMonthly: 79,
    priceAnnual: 790,
  },
  portfolio: {
    slug: "portfolio",
    name: "Portfolio",
    maxStores: 5,
    maxMonthlyEvents: 2_000_000,
    warmupUrlsPerEvent: 500,
    logRetentionDays: 180,
    priceMonthly: 149,
    priceAnnual: 1490,
  },
};

export function getTier(slug: string): TierConfig {
  const tier = TIERS[slug as TierSlug];
  if (!tier) throw new Error(`Unknown tier: ${slug}`);
  return tier;
}

export function getDefaultTier(): TierConfig {
  return TIERS.solo;
}
