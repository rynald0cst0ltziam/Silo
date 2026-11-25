import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIERS, type TierSlug } from "@/lib/tiers";
import { getAccess, trialCarriesOver, trialEndLabel, type AccessState } from "@/lib/entitlements";
import { BillingIntervalToggle } from "@/components/billing-interval-toggle";
import { asInterval, asPlan } from "@/lib/plan-intent";
import { CheckoutRefresh } from "@/components/account/checkout-refresh";
import { PlanLimitsTable } from "@/components/plan-limits-table";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

const TIER_ORDER: TierSlug[] = ["solo", "studio", "portfolio"];

const STATE_LABEL: Record<AccessState, { label: string; tone: string }> = {
  trial: { label: "Free trial", tone: "border-accent/30 bg-accent/10 text-accent" },
  active: { label: "Active", tone: "border-mint/25 bg-mint/10 text-mint" },
  comped: { label: "Complimentary", tone: "border-mint/25 bg-mint/10 text-mint" },
  past_due: { label: "Payment failed", tone: "border-amber/30 bg-amber/10 text-amber" },
  expired: { label: "Trial ended", tone: "border-red-500/30 bg-red-500/10 text-red-300" },
  canceled: { label: "Ended", tone: "border-red-500/30 bg-red-500/10 text-red-300" },
  suspended: { label: "Suspended", tone: "border-red-500/30 bg-red-500/10 text-red-300" },
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(minor / 100);
}

function day(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function compact(n: number) {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

function Meter({ label, used, max, hint }: { label: string; used: number; max: number; hint?: string }) {
  const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
  const color = pct >= 95 ? "bg-red-400" : pct >= 80 ? "bg-amber" : "bg-mint";
  return (
    <div className="border border-white/8 bg-[#0b0d11] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium uppercase tracking-wider text-paper/45">{label}</p>
        <p className="font-mono text-[15px] text-paper/85">
          {used.toLocaleString()} <span className="text-paper/35">/ {compact(max)}</span>
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden bg-white/[0.06]">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {hint ? <p className="mt-2 text-[13px] text-paper/45">{hint}</p> : null}
    </div>
  );
}

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; plan?: string; interval?: string }> }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const { checkout, plan: planParam, interval: intervalParam } = await searchParams;
  const chosenPlan = asPlan(planParam);
  const chosenInterval = asInterval(intervalParam) ?? "month";

  const access = getAccess(user);
  const sub = user.subscription;
  const live = !!sub && ["active", "trialing", "past_due", "incomplete"].includes(sub.status);
  const paidTier = sub ? TIERS[sub.tier as TierSlug] : null;

  const [stores, invoices] = await Promise.all([
    prisma.store.findMany({ where: { userId: user.id }, select: { monthlyEvents: true, monthlyEventsReset: true } }),
    prisma.invoice.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 24 }),
  ]);
  const eventsUsed = stores.reduce((sum, s) => sum + s.monthlyEvents, 0);
  const now = new Date();
  const resetsOn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const state = STATE_LABEL[access.state];

  let price: string | null = null;
  if (live && sub) {
    price = sub.amount != null && sub.currency
      ? money(sub.amount, sub.currency)
      : `$${paidTier ? (sub.billingInterval === "year" ? paidTier.priceAnnual : paidTier.priceMonthly) : 0}`;
  }

  let timeline = "";
  if (access.state === "trial") timeline = `Trial ends ${trialEndLabel(access)}. No card on file, nothing is charged. Caching pauses when the trial ends unless a plan is chosen.`;
  else if (live && sub?.status === "trialing" && sub.trialEnd) timeline = `First charge on ${day(sub.trialEnd)}.`;
  else if (live && sub?.cancelAtPeriodEnd) timeline = `Cancels on ${day(sub.currentPeriodEnd)}. Caching keeps running until then.`;
  else if (live && sub) timeline = `Renews ${day(sub.currentPeriodEnd)}.`;
  else if (access.state === "comped") timeline = "Complimentary plan set by Silo. No charges.";
  else if (access.state === "expired" || access.state === "canceled") timeline = "Caching is paused on connected stores. Choose a plan to switch it back on instantly.";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-paper">Billing</h1>
        <p className="mt-1 text-[15px] text-paper/50">Plan, usage, invoices and payment method.</p>
      </div>

      {checkout === "success" ? (
        <div className="border border-mint/25 bg-mint/[0.07] px-4 py-3 text-[14px] text-paper/85" role="status">
          {live ? "Thanks — your plan is active." : "Thanks — payment confirmed. Your plan appears here within a few seconds."}
          {!live ? <CheckoutRefresh /> : null}
        </div>
      ) : checkout === "canceled" ? (
        <div className="border border-white/10 bg-white/[0.03] px-4 py-3 text-[14px] text-paper/70">Checkout was canceled. Nothing was charged.</div>
      ) : null}

      <section className="border border-white/8 bg-[#0b0d11] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <p className="text-[20px] font-semibold text-paper">
                {access.plan ? `${TIERS[access.plan].name} plan` : access.state === "trial" ? "Free trial" : "No plan"}
              </p>
              <span className={`border px-2 py-0.5 font-mono text-[12px] uppercase tracking-wider ${state.tone}`}>{state.label}</span>
            </div>
            <p className="mt-2 text-[14px] text-paper/60">{timeline}</p>
          </div>
          {price ? (
            <p className="font-mono text-[26px] text-paper">
              {price}
              <span className="text-[14px] text-paper/40">/{sub!.billingInterval === "year" ? "year" : "month"}</span>
            </p>
          ) : null}
        </div>

        {user.stripeCustomerId ? (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/8 pt-5">
            <a
              href="/api/billing/portal"
              className="inline-flex items-center gap-2 bg-white/[0.07] px-4 py-2 text-[14px] font-medium text-paper transition hover:bg-white/[0.12]"
            >
              {live ? "Change plan, card or cancel" : "Payment method and history"}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="text-[13px] text-paper/45">Opens the secure Stripe billing portal. Plan changes are prorated.</p>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-[17px] font-semibold text-paper">Usage this month</h2>
        <p className="mt-1 text-[14px] text-paper/50">
          Limits for the {access.tier.name} {access.plan ? "plan" : "trial"}. Event counts reset on {day(resetsOn)} (UTC).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Meter label="Stores" used={stores.length} max={access.tier.maxStores} hint={stores.length > access.tier.maxStores ? "Stores past the limit are paused." : undefined} />
          <Meter label="Catalog events" used={eventsUsed} max={access.tier.maxMonthlyEvents} hint="Shared by all your stores. At the limit, pages still purge on your stores; logging and warmup pause until the 1st." />
          <div className="border border-white/8 bg-[#0b0d11] p-4">
            <p className="text-[13px] font-medium uppercase tracking-wider text-paper/45">Warmup per change</p>
            <p className="mt-2 font-mono text-[22px] text-paper"><span className="text-[14px] text-paper/40">up to </span>{access.tier.warmupUrlsPerEvent.toLocaleString("en-US")} <span className="text-[14px] text-paper/40">pages</span></p>
          </div>
          <div className="border border-white/8 bg-[#0b0d11] p-4">
            <p className="text-[13px] font-medium uppercase tracking-wider text-paper/45">Log retention</p>
            <p className="mt-2 font-mono text-[22px] text-paper">{access.tier.logRetentionDays} <span className="text-[14px] text-paper/40">days</span></p>
          </div>
        </div>
      </section>

      {!live && access.state !== "comped" && access.state !== "suspended" ? (
        <section id="plans" className="scroll-mt-24">
          <h2 className="text-[17px] font-semibold text-paper">Plans</h2>
          <div className="mt-4">
            <BillingIntervalToggle
              tiers={TIER_ORDER.map((slug) => TIERS[slug])}
              initialInterval={chosenInterval}
              selected={chosenPlan}
              intro={
                access.state === "trial"
                  ? trialCarriesOver(access)
                    ? `Pick a plan and when it starts: today, or when your free trial ends (${trialEndLabel(access)}).`
                    : `Your trial ends ${trialEndLabel(access)}. Choose a plan to keep caching on; billing starts today.`
                  : "Choose a plan to switch caching back on. Billing starts today."
              }
              trialCarry={trialCarriesOver(access)}
              trialEndsLabel={trialEndLabel(access)}
            />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-[17px] font-semibold text-paper">Plan limits</h2>
        <div className="mt-3">
          <PlanLimitsTable tone="dark" current={access.plan} />
        </div>
      </section>

      <section>
        <h2 className="text-[17px] font-semibold text-paper">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="mt-3 border border-white/8 bg-[#0b0d11] px-4 py-5 text-[14px] text-paper/50">No invoices yet. They appear here as soon as Stripe issues them.</p>
        ) : (
          <div className="mt-3 overflow-x-auto border border-white/8">
            <table className="w-full min-w-[560px] text-left text-[14px]">
              <thead className="bg-white/[0.03] text-[12px] uppercase tracking-wider text-paper/45">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Invoice</th>
                  <th className="px-4 py-2.5 font-medium">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="text-paper/80">
                    <td className="px-4 py-3">{day(inv.createdAt)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{inv.number ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{money(inv.status === "paid" ? inv.amountPaid : inv.amountDue, inv.currency)}</td>
                    <td className="px-4 py-3">
                      <span className={inv.status === "paid" ? "text-mint" : inv.status === "open" ? "text-amber" : "text-paper/50"}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex gap-3">
                        {inv.hostedUrl ? (
                          <a href={inv.hostedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                            View <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                            PDF <FileText className="h-3 w-3" />
                          </a>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
