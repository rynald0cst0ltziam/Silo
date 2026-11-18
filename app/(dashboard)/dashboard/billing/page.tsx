import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { TIERS, type TierSlug } from "@/lib/tiers";
import { BillingIntervalToggle } from "@/components/billing-interval-toggle";

export const metadata: Metadata = {
  title: "Billing",
  robots: { index: false, follow: false },
};

const TIER_ORDER: TierSlug[] = ["solo", "studio", "portfolio"];

export default async function BillingPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const sub = user.subscription;
  const currentTier = sub ? TIERS[sub.tier as TierSlug] : null;

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-paper">
        Billing
      </h1>
      <p className="mt-1 text-[12px] text-paper/40">
        Manage your subscription and payment method.
      </p>

      {currentTier ? (
        <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-paper/80">
                {currentTier.name} plan
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-paper/35">
                {sub!.status === "trialing" ? "Trial" : sub!.billingInterval === "year" ? "Annual" : "Monthly"} · {sub!.status}
              </p>
            </div>
            <p className="font-mono text-[18px] text-paper/70">
              ${sub!.billingInterval === "year" ? currentTier.priceAnnual : currentTier.priceMonthly}
              <span className="text-[10px] text-paper/30">
                /{sub!.billingInterval === "year" ? "yr" : "mo"}
              </span>
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-white/6 p-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-paper/30">Stores</p>
              <p className="mt-1 text-[13px] text-paper/60">{currentTier.maxStores}</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-paper/30">Events/mo</p>
              <p className="mt-1 text-[13px] text-paper/60">{(currentTier.maxMonthlyEvents / 1000).toFixed(0)}k</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-wider text-paper/30">Log retention</p>
              <p className="mt-1 text-[13px] text-paper/60">{currentTier.logRetentionDays}d</p>
            </div>
          </div>

          {sub!.trialEnd && new Date(sub!.trialEnd) > new Date() && (
            <p className="mt-3 text-[11px] text-mint/70">
              Trial ends {new Date(sub!.trialEnd).toLocaleDateString()}
            </p>
          )}

          <div className="mt-4 border-t border-white/6 pt-4">
            <a
              href="/api/billing/portal"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-[11px] font-medium text-paper/70 transition hover:bg-white/8"
            >
              Manage subscription
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-6">
          <BillingIntervalToggle tiers={TIER_ORDER.map((slug) => TIERS[slug])} />
        </div>
      )}
    </div>
  );
}
