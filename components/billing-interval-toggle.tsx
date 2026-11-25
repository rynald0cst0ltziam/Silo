"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutButton } from "@/components/checkout-button";
import { perMonth, type Interval } from "@/lib/plan-intent";
import type { TierConfig } from "@/lib/tiers";

/**
 * Plan picker on the Billing page: Monthly / Annual toggle, then Stripe Checkout for the
 * chosen plan and interval. Opens on the plan and interval picked on the pricing page.
 */
export function BillingIntervalToggle({
  tiers,
  intro,
  initialInterval = "month",
  selected = null,
}: {
  tiers: TierConfig[];
  intro?: string;
  initialInterval?: Interval;
  selected?: string | null;
}) {
  const [interval, setInterval] = useState<Interval>(initialInterval);
  const annual = interval === "year";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-paper/55">{intro ?? "Choose a plan to get started."}</p>
        <div role="radiogroup" aria-label="Billing interval" className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3.5 py-1.5 text-[14px] font-medium transition",
                interval === value ? "bg-white/12 text-paper" : "text-paper/45 hover:text-paper/75",
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
              {value === "year" ? <span className="rounded bg-mint/15 px-1.5 py-0.5 text-[11px] font-semibold text-mint">2 months free</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiers.map((tier) => {
          const isSelected = selected === tier.slug;
          const saving = tier.priceMonthly * 12 - tier.priceAnnual;
          return (
            <div
              key={tier.slug}
              className={cn(
                "relative rounded-xl border p-5",
                isSelected ? "border-accent bg-accent/[0.07]" : tier.slug === "studio" ? "border-accent/30 bg-accent/[0.04]" : "border-white/8 bg-[#0b0d11]",
              )}
            >
              {isSelected ? (
                <span className="absolute -top-2.5 left-4 rounded bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Your choice</span>
              ) : null}
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-medium text-paper/85">{tier.name}</h3>
                <span className="font-mono text-[12px] text-paper/35">
                  {tier.maxStores} store{tier.maxStores > 1 ? "s" : ""}
                </span>
              </div>

              <div className="mt-3 flex items-end gap-1.5">
                <span className="text-[30px] font-semibold leading-none tracking-tight text-paper">
                  ${annual ? perMonth(tier.priceAnnual) : tier.priceMonthly}
                </span>
                <span className="pb-0.5 text-[13px] text-paper/40">/mo</span>
                {annual ? <span className="pb-0.5 text-[14px] text-paper/30 line-through">${tier.priceMonthly}</span> : null}
              </div>
              <p className="mt-1.5 text-[13px] text-paper/50">
                {annual ? (
                  <>
                    ${tier.priceAnnual.toLocaleString("en-US")} billed yearly · <span className="text-mint">save ${saving}</span>
                  </>
                ) : (
                  <>Billed monthly · or ${tier.priceAnnual.toLocaleString("en-US")}/yr</>
                )}
              </p>

              <ul className="mt-4 space-y-1.5">
                <li className="flex items-center gap-2 text-[13px] text-paper/55">
                  <Check className="h-3 w-3 text-mint/70" />
                  {tier.maxMonthlyEvents.toLocaleString("en-US")} events/month
                </li>
                <li className="flex items-center gap-2 text-[13px] text-paper/55">
                  <Check className="h-3 w-3 text-mint/70" />
                  Warmup of up to {tier.warmupUrlsPerEvent.toLocaleString("en-US")} pages per change
                </li>
                <li className="flex items-center gap-2 text-[13px] text-paper/55">
                  <Check className="h-3 w-3 text-mint/70" />
                  {tier.logRetentionDays}-day log retention
                </li>
              </ul>

              <CheckoutButton
                tier={tier.slug}
                interval={interval}
                variant={isSelected || (!selected && tier.slug === "studio") ? "primary" : "outline"}
                className="mt-5 w-full"
              >
                Choose {tier.name} {annual ? "annual" : "monthly"}
              </CheckoutButton>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-center text-[12px] text-paper/35">
        Secure checkout by Stripe · prorated plan changes · cancel anytime
      </p>
    </div>
  );
}
