import { prisma } from "@/lib/prisma";
import { TIERS, getDefaultTier, type TierConfig, type TierSlug } from "@/lib/tiers";
import { isAdmin } from "@/lib/admin-check";

export const TRIAL_DAYS = 7;
const DAY = 86_400_000;

/** Stripe statuses that keep the service running. past_due is Stripe's retry window. */
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

export type AccessState = "trial" | "active" | "past_due" | "comped" | "expired" | "canceled" | "suspended";

export type Access = {
  state: AccessState;
  /** Whether Silo serves, invalidates and warms for this account. */
  active: boolean;
  tier: TierConfig;
  /** Plan the account pays for (or was given), null during the free trial. */
  plan: TierSlug | null;
  trialEndsAt: Date;
  trialDaysLeft: number;
  /** Short line for banners and the connector. */
  message: string;
};

export type AccessUser = {
  createdAt: Date;
  email?: string | null;
  role?: string | null;
  trialEndsAt?: Date | null;
  planOverride?: string | null;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
  subscription?: { tier: string; status: string; currentPeriodEnd?: Date; cancelAtPeriodEnd?: boolean } | null;
};

/** Fields to select wherever access is computed. */
export const ACCESS_SELECT = {
  createdAt: true,
  email: true,
  role: true,
  trialEndsAt: true,
  planOverride: true,
  suspendedAt: true,
  suspendedReason: true,
  subscription: true,
} as const;

function tierOf(slug: string | null | undefined): TierConfig | null {
  return slug && TIERS[slug as TierSlug] ? TIERS[slug as TierSlug] : null;
}

export function trialEnd(user: Pick<AccessUser, "createdAt" | "trialEndsAt">): Date {
  return user.trialEndsAt ?? new Date(user.createdAt.getTime() + TRIAL_DAYS * DAY);
}

/**
 * One answer to "what may this account use right now", shared by the dashboard,
 * billing, every connector route and the admin console.
 *
 * Order: suspension wins, then a complimentary plan, then a paying subscription,
 * then the no-card trial. After the trial, without a plan, the account is expired:
 * connectors are told to stop serving cached pages (never stale prices) until a plan starts.
 */
export function getAccess(user: AccessUser, now = new Date()): Access {
  const ends = trialEnd(user);
  const trialDaysLeft = Math.max(0, Math.ceil((ends.getTime() - now.getTime()) / DAY));
  const base = { trialEndsAt: ends, trialDaysLeft };

  if (user.suspendedAt) {
    return {
      ...base,
      state: "suspended",
      active: false,
      tier: getDefaultTier(),
      plan: null,
      message: `This Silo account is suspended${user.suspendedReason ? `: ${user.suspendedReason}` : ""}. Contact support.`,
    };
  }

  // Silo's own operators run on the top plan, so their test stores never pause.
  const comp = tierOf(user.planOverride) ?? (isAdmin(user) ? TIERS.portfolio : null);
  if (comp) {
    return { ...base, state: "comped", active: true, tier: comp, plan: comp.slug, message: `${comp.name} plan (complimentary)` };
  }

  const sub = user.subscription;
  const paid = sub ? tierOf(sub.tier) : null;
  if (sub && paid && PAID_STATUSES.has(sub.status)) {
    if (sub.status === "past_due") {
      return {
        ...base,
        state: "past_due",
        active: true,
        tier: paid,
        plan: paid.slug,
        message: "The last payment failed. Update the card in Billing to keep Silo running.",
      };
    }
    return { ...base, state: "active", active: true, tier: paid, plan: paid.slug, message: `${paid.name} plan` };
  }

  if (now < ends) {
    return {
      ...base,
      state: "trial",
      active: true,
      tier: getDefaultTier(),
      plan: null,
      message: `Free trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left`,
    };
  }

  const canceled = !!sub && sub.status === "canceled";
  return {
    ...base,
    state: canceled ? "canceled" : "expired",
    active: false,
    tier: paid ?? getDefaultTier(),
    plan: null,
    message: canceled
      ? "The Silo subscription has ended. Choose a plan in Billing to switch caching back on."
      : "The Silo trial has ended. Choose a plan in Billing to switch caching back on.",
  };
}

/**
 * Stores an account may run: the oldest N for its plan. Stores past the limit after a
 * downgrade stay listed but paused until one is removed or the plan is raised.
 */
export async function activeStoreIds(userId: string, tier: TierConfig): Promise<Set<string>> {
  const stores = await prisma.store.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: tier.maxStores,
  });
  return new Set(stores.map((s) => s.id));
}

export type StoreAccess = Access & { storeActive: boolean; storeMessage: string };

/**
 * Access for one store: the account must be active and the store inside the plan's store count.
 */
export async function getStoreAccess(storeId: string, userId: string): Promise<StoreAccess | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ACCESS_SELECT });
  if (!user) return null;
  const access = getAccess(user);
  if (!access.active) {
    return { ...access, storeActive: false, storeMessage: access.message };
  }
  const allowed = await activeStoreIds(userId, access.tier);
  if (!allowed.has(storeId)) {
    return {
      ...access,
      storeActive: false,
      storeMessage: `The ${access.tier.name} plan covers ${access.tier.maxStores} store${access.tier.maxStores === 1 ? "" : "s"}. This store is paused — upgrade or remove a store in your Silo dashboard.`,
    };
  }
  return { ...access, storeActive: true, storeMessage: access.message };
}

/** Stripe accepts a trial only if it ends at least 48 hours out; true when the rest of the trial carries into a subscription. */
export function trialCarriesOver(access: Pick<Access, "state" | "trialEndsAt">, now = Date.now()): boolean {
  return access.state === "trial" && access.trialEndsAt.getTime() - now > 48 * 3_600_000 + 600_000;
}

/** "Nov 27, 3:04 PM UTC" */
export function trialEndLabel(access: Pick<Access, "trialEndsAt">): string {
  return `${access.trialEndsAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" })} UTC`;
}
