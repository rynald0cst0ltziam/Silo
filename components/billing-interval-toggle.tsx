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
  trialCarry = false,
  trialEndsLabel = "",
}: {
  tiers: TierConfig[];
  intro?: string;
  initialInterval?: Interval;
  selected?: string | null;
  /** True while free-trial time can still carry into the subscription (charge deferred). */
  trialCarry?: boolean;
  trialEndsLabel?: string;
}) {
  const [interval, setInterval] = useState<Interval>(initialInterval);
  const [startToday, setStartToday] = useState(false);
  const annual = interval === "year";
  const deferred = trialCarry && !startToday;

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

      {trialCarry ? (
        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          <legend className="mb-2 text-[13px] font-medium text-paper/70">When should your paid plan start?</legend>
          {[
            { value: false, title: "When my trial ends", body: `Nothing is charged today. Your card is charged on ${trialEndsLabel}.` },
            { value: true, title: "Today", body: "Pay now and start the paid plan straight away. The rest of the free trial is skipped." },
          ].map((option) => (
            <label
              key={String(option.value)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition",
                startToday === option.value ? "border-accent bg-accent/[0.08]" : "border-white/10 bg-white/[0.02] hover:border-white/20",
              )}
            >
              <input
                type="radio"
                name="plan-start"
                checked={startToday === option.value}
                onChange={() => setStartToday(option.value)}
                className="mt-1 accent-[#3d6bff]"
              />
              <span>
                <span className="block text-[14px] font-medium text-paper">{option.title}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-paper/55">{option.body}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

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
                startNow={trialCarry && startToday}
                variant={isSelected || (!selected && tier.slug === "studio") ? "primary" : "outline"}
                className="mt-5 w-full"
              >
                {deferred
                  ? `Choose ${tier.name} ${annual ? "annual" : "monthly"}`
                  : `Pay $${(annual ? tier.priceAnnual : tier.priceMonthly).toLocaleString("en-US")} now`}
              </CheckoutButton>
              <p className="mt-2 text-center text-[12px] text-paper/40">
                {deferred
                  ? `$0 today · first charge ${trialEndsLabel}`
                  : `Then $${(annual ? tier.priceAnnual : tier.priceMonthly).toLocaleString("en-US")} every ${annual ? "year" : "month"}`}
              </p>
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
