import { prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/utils";
import type { StoreAccess } from "@/lib/entitlements";

export type PlanStatus = {
  state: string;
  active: boolean;
  plan: string | null;
  tier: string;
  message: string;
  trial_ends_at: number | null;
  trial_days_left: number | null;
  events_used: number;
  events_limit: number;
  warmup_per_event: number;
  stores_used: number;
  stores_limit: number;
  log_days: number;
  resets_at: number;
  billing_url: string;
};

/**
 * Plan, trial and usage summary sent to the connector with every heartbeat so the
 * WordPress dashboard can show exactly what the Silo dashboard shows.
 */
export async function planStatus(userId: string, access: StoreAccess): Promise<PlanStatus> {
  const [usage, stores] = await Promise.all([
    prisma.store.aggregate({ where: { userId }, _sum: { monthlyEvents: true } }),
    prisma.store.count({ where: { userId } }),
  ]);
  const now = new Date();
  return {
    state: access.storeActive ? access.state : access.active ? "store_paused" : access.state,
    active: access.storeActive,
    plan: access.plan,
    tier: access.tier.name,
    message: access.storeMessage,
    trial_ends_at: access.state === "trial" ? Math.floor(access.trialEndsAt.getTime() / 1000) : null,
    trial_days_left: access.state === "trial" ? access.trialDaysLeft : null,
    events_used: usage._sum.monthlyEvents ?? 0,
    events_limit: access.tier.maxMonthlyEvents,
    warmup_per_event: access.tier.warmupUrlsPerEvent,
    stores_used: stores,
    stores_limit: access.tier.maxStores,
    log_days: access.tier.logRetentionDays,
    resets_at: Math.floor(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) / 1000),
    billing_url: `${siteUrl().replace(/\/+$/, "")}/dashboard/billing`,
  };
}
