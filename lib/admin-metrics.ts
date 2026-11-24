import { prisma } from "@/lib/prisma";
import { TIERS, type TierSlug } from "@/lib/tiers";
import { getAccess, ACCESS_SELECT, type AccessState } from "@/lib/entitlements";

export const ONLINE_MS = 150_000;
const DAY = 86_400_000;

/** Monthly recurring value of one subscription in minor units (USD cents unless Stripe says otherwise). */
export function monthlyValue(sub: { tier: string; billingInterval: string; amount: number | null }): number {
  const tier = TIERS[sub.tier as TierSlug];
  const yearly = sub.billingInterval === "year";
  const amount = sub.amount ?? (tier ? (yearly ? tier.priceAnnual : tier.priceMonthly) * 100 : 0);
  return yearly ? Math.round(amount / 12) : amount;
}

export function money(minor: number, currency = "usd", digits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(minor / 100);
}

export type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: Date;
  lastLoginAt: Date | null;
  state: AccessState;
  plan: string | null;
  tierName: string;
  trialDaysLeft: number;
  stores: number;
  eventsMonth: number;
  mrr: number;
};

/** Every account with its live access state, ready for tables and KPIs. */
export async function loadUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      ...ACCESS_SELECT,
      id: true,
      email: true,
      name: true,
      role: true,
      lastLoginAt: true,
      stores: { select: { monthlyEvents: true } },
    },
  });
  return users.map((u) => {
    const access = getAccess(u);
    const sub = u.subscription;
    const paying = !!sub && (sub.status === "active" || sub.status === "past_due") && access.state !== "comped";
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      state: access.state,
      plan: access.plan,
      tierName: access.tier.name,
      trialDaysLeft: access.trialDaysLeft,
      stores: u.stores.length,
      eventsMonth: u.stores.reduce((n, s) => n + s.monthlyEvents, 0),
      mrr: paying && sub ? monthlyValue(sub) : 0,
    };
  });
}

/** Headline numbers for the admin overview. */
export async function loadOverview() {
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY);
  const since7 = new Date(now - 7 * DAY);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [users, stores, subs, paid30, eventsToday, warm24, versions] = await Promise.all([
    loadUsers(),
    prisma.store.findMany({ select: { id: true, status: true, lastSeenAt: true, monthlyEvents: true, connectorVersion: true, connectorEnv: true } }),
    prisma.subscription.findMany({ select: { tier: true, billingInterval: true, amount: true, status: true, cancelAtPeriodEnd: true } }),
    prisma.invoice.aggregate({ where: { status: "paid", createdAt: { gte: since30 } }, _sum: { amountPaid: true }, _count: true }),
    prisma.event.count({ where: { createdAt: { gte: today } } }),
    prisma.warmupJob.count({ where: { createdAt: { gte: new Date(now - DAY) } } }),
    prisma.store.groupBy({ by: ["connectorVersion"], _count: true }),
  ]);

  const byState = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.state] = (acc[u.state] ?? 0) + 1;
    return acc;
  }, {});
  const mrr = users.reduce((n, u) => n + u.mrr, 0);
  const trialingSubs = subs.filter((s) => s.status === "trialing");
  const pipeline = trialingSubs.reduce((n, s) => n + monthlyValue(s), 0);
  const online = stores.filter((s) => s.lastSeenAt && now - s.lastSeenAt.getTime() < ONLINE_MS).length;
  const coexist = stores.filter((s) => (s.connectorEnv as { cache_mode?: string } | null)?.cache_mode === "coexist").length;

  const byTier = Object.values(TIERS).map((tier) => {
    const list = subs.filter((s) => s.tier === tier.slug && (s.status === "active" || s.status === "past_due"));
    return {
      tier: tier.name,
      count: list.length,
      mrr: list.reduce((n, s) => n + monthlyValue(s), 0),
      annual: list.filter((s) => s.billingInterval === "year").length,
    };
  });

  return {
    users: users.length,
    newUsers7: users.filter((u) => u.createdAt >= since7).length,
    newUsers30: users.filter((u) => u.createdAt >= since30).length,
    byState,
    mrr,
    arr: mrr * 12,
    pipeline,
    trialingSubs: trialingSubs.length,
    canceling: subs.filter((s) => s.cancelAtPeriodEnd && s.status !== "canceled").length,
    revenue30: paid30._sum.amountPaid ?? 0,
    invoices30: paid30._count,
    stores: stores.length,
    online,
    coexist,
    eventsMonth: stores.reduce((n, s) => n + s.monthlyEvents, 0),
    eventsToday,
    warm24,
    byTier,
    versions: versions
      .map((v) => ({ version: v.connectorVersion ?? "not installed", count: v._count }))
      .sort((a, b) => b.count - a.count),
    recentUsers: users.slice(0, 8),
  };
}
