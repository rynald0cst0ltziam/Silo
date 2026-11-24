import { prisma } from "@/lib/prisma";
import { getAccess, type AccessUser } from "@/lib/entitlements";
import type { TierConfig } from "@/lib/tiers";

/**
 * Limits that apply to an account right now (trial, paid, complimentary or lapsed).
 */
export function getUserTier(user: AccessUser): TierConfig {
  return getAccess(user).tier;
}

export async function canCreateStore(userId: string, tier: TierConfig): Promise<{ allowed: boolean; current: number; max: number }> {
  const current = await prisma.store.count({ where: { userId } });
  return { allowed: current < tier.maxStores, current, max: tier.maxStores };
}
