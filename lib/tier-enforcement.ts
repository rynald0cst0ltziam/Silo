import { prisma } from "@/lib/prisma";
import { TIERS, getDefaultTier, type TierConfig, type TierSlug } from "@/lib/tiers";

export function getUserTier(subscription: { tier: string; status: string } | null): TierConfig {
  if (!subscription) return getDefaultTier();
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return getDefaultTier();
  }
  return TIERS[subscription.tier as TierSlug] ?? getDefaultTier();
}

export async function canCreateStore(userId: string, tier: TierConfig): Promise<{ allowed: boolean; current: number; max: number }> {
  const current = await prisma.store.count({ where: { userId } });
  return { allowed: current < tier.maxStores, current, max: tier.maxStores };
}

export async function canProcessEvent(storeId: string, tier: TierConfig): Promise<{ allowed: boolean; used: number; max: number }> {
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { monthlyEvents: true },
  });
  const used = store?.monthlyEvents ?? 0;
  return { allowed: used < tier.maxMonthlyEvents, used, max: tier.maxMonthlyEvents };
}
