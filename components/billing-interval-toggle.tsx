"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckoutButton } from "@/components/checkout-button";
import type { TierConfig } from "@/lib/tiers";

export function BillingIntervalToggle({ tiers, intro }: { tiers: TierConfig[]; intro?: string }) {
  const [interval, setInterval] = useState<"month" | "year">("month");

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[14px] text-paper/55">{intro ?? "Choose a plan to get started."}</p>
        <div className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.03] p-0.5">
          <button
            type="button"
            onClick={() => setInterval("month")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
              interval === "month"
                ? "bg-white/10 text-paper"
                : "text-paper/40 hover:text-paper/60",
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("year")}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition",
              interval === "year"
                ? "bg-white/10 text-paper"
                : "text-paper/40 hover:text-paper/60",
            )}
          >
            Annual
            <span className="ml-1.5 text-[11px] text-mint/70">save 2 months</span>
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.slug}
            className={cn(
              "rounded-xl border p-5",
              tier.slug === "studio"
                ? "border-accent/30 bg-accent/[0.04]"
                : "border-white/8 bg-[#0b0d11]",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-paper/80">{tier.name}</h3>
              <span className="font-mono text-[12px] text-paper/30">
                {tier.maxStores} store{tier.maxStores > 1 ? "s" : ""}
              </span>
            </div>

            <div className="mt-3 flex items-end gap-1">
              <span className="text-[28px] font-semibold leading-none tracking-tight text-paper">
                ${interval === "year" ? tier.priceAnnual : tier.priceMonthly}
              </span>
              <span className="pb-0.5 text-[13px] text-paper/30">
                /{interval === "year" ? "yr" : "mo"}
              </span>
            </div>

            <ul className="mt-4 space-y-1.5">
              <li className="flex items-center gap-2 text-[13px] text-paper/45">
                <Check className="h-3 w-3 text-mint/60" />
                {(tier.maxMonthlyEvents / 1000).toFixed(0)}k events/month
              </li>
              <li className="flex items-center gap-2 text-[13px] text-paper/45">
                <Check className="h-3 w-3 text-mint/60" />
                {tier.warmupUrlsPerEvent} warmup URLs/event
              </li>
              <li className="flex items-center gap-2 text-[13px] text-paper/45">
                <Check className="h-3 w-3 text-mint/60" />
                {tier.logRetentionDays}-day log retention
              </li>
            </ul>

            <CheckoutButton
              tier={tier.slug}
              interval={interval}
              variant={tier.slug === "studio" ? "primary" : "outline"}
              className="mt-5 w-full"
            >
              Choose {tier.name}
            </CheckoutButton>
          </div>
        ))}
      </div>

      <p className="mt-3 text-center text-[12px] text-paper/25">
        Secure checkout by Stripe · prorated plan changes · cancel anytime
      </p>
    </div>
  );
}
