"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Check, Layers } from "lucide-react";
import { PLANS } from "@/lib/content";
import { billingUrl, perMonth, type Interval, type PlanSlug } from "@/lib/plan-intent";
import { cn } from "@/lib/utils";

/**
 * Plan cards with a Monthly / Annual toggle. The button carries the chosen plan and
 * interval: signed-in visitors go straight to Billing with it preselected; everyone else
 * signs up first (3-day trial, no card) and lands on Billing with the same choice.
 */
export function PricingCards() {
  const [interval, setInterval] = useState<Interval>("month");
  const { status } = useSession();
  const signedIn = status === "authenticated";
  const annual = interval === "year";

  return (
    <div>
      <div className="mb-10 flex flex-col items-center gap-3">
        <div role="radiogroup" aria-label="Billing interval" className="inline-flex items-center gap-1 rounded-full border border-ink/12 bg-white/70 p-1">
          {(["month", "year"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "flex items-center gap-2 rounded-full px-5 py-2 text-[14px] font-medium transition",
                interval === value ? "bg-ink text-paper" : "text-ink/55 hover:text-ink",
              )}
            >
              {value === "month" ? "Monthly" : "Annual"}
              {value === "year" ? (
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", interval === "year" ? "bg-mint text-ink" : "bg-mint/20 text-mint-deep")}>
                  2 months free
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-ink/45">
          {annual ? "Billed once a year. Prices shown per month." : "Billed monthly. Switch to annual any time and get 2 months free."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {PLANS.map((plan) => {
          const slug = plan.name.toLowerCase() as PlanSlug;
          const target = billingUrl(slug, interval);
          const href = signedIn ? target : `/sign-up?next=${encodeURIComponent(target)}`;
          const saving = plan.price * 12 - plan.annual;

          return (
            <article
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl p-6 sm:p-7",
                plan.popular
                  ? "border border-white/10 bg-ink text-paper shadow-[0_28px_70px_-30px_rgba(8,9,11,0.55)] lg:-mt-4 lg:mb-0 lg:pb-9"
                  : "border border-ink/10 bg-white/55 text-ink",
              )}
            >
              {plan.popular && <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />}

              <div className="flex items-center justify-between gap-3">
                <h3 className={cn("font-display text-[21px] font-medium tracking-[-0.03em]", plan.popular ? "text-paper" : "text-ink")}>{plan.name}</h3>
                <span className={cn("chip", plan.popular && "border-white/15 text-paper/60")}>{plan.storeLabel}</span>
              </div>

              <p className={cn("mt-2 text-[13px] leading-relaxed", plan.popular ? "text-paper/50" : "text-ink/50")}>{plan.tagline}</p>

              <div className="mt-7 flex items-end gap-1.5">
                <span className={cn("font-display text-[50px] leading-none tracking-[-0.05em]", plan.popular ? "text-paper" : "text-ink")}>
                  ${annual ? perMonth(plan.annual) : plan.price}
                </span>
                <span className={cn("pb-1.5 text-[13px]", plan.popular ? "text-paper/45" : "text-ink/45")}>/ month</span>
                {annual ? (
                  <span className={cn("mb-2 ml-1 font-display text-[18px] line-through", plan.popular ? "text-paper/30" : "text-ink/30")}>${plan.price}</span>
                ) : null}
              </div>
              <p className={cn("mt-2 text-[13px]", plan.popular ? "text-paper/55" : "text-ink/55")}>
                {annual ? (
                  <>
                    ${plan.annual.toLocaleString("en-US")} billed yearly ·{" "}
                    <span className={plan.popular ? "text-mint" : "text-mint-deep"}>you save ${saving}</span>
                  </>
                ) : (
                  <>
                    or ${plan.annual.toLocaleString("en-US")} a year (2 months free)
                  </>
                )}
              </p>

              <Link
                href={href}
                className={cn(
                  "mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-[14px] font-medium transition",
                  plan.popular ? "bg-accent text-white hover:bg-accent/90" : "border border-ink/15 text-ink hover:bg-ink hover:text-paper",
                )}
              >
                {signedIn ? `Choose ${plan.name} ${annual ? "annual" : "monthly"}` : "Start 3-day free trial"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className={cn("mt-2.5 text-center font-mono text-[10.5px] uppercase tracking-[0.06em]", plan.popular ? "text-paper/35" : "text-ink/40")}>
                {signedIn ? "Secure checkout by Stripe" : "3 days free · no card needed"}
              </p>

              <div className={cn("my-6 h-px", plan.popular ? "bg-white/10" : "bg-ink/10")} />

              <div className="flex-1">
                <p className={cn("font-mono text-[10px] uppercase tracking-[0.12em]", plan.popular ? "text-paper/40" : "text-ink/40")}>{plan.events}</p>
                <ul className="mt-4 space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", plan.popular ? "text-mint/80" : "text-accent-deep")} />
                      <span className={cn("text-[13px] leading-[1.5]", plan.popular ? "text-paper/60" : "text-ink/60")}>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-accent px-3 py-1 font-mono text-[8.5px] uppercase tracking-[0.1em] text-white">
                  Most chosen
                </span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function StoreIsolationNote() {
  return (
    <div className="mt-8 flex flex-col gap-5 rounded-xl border border-ink/10 bg-white/40 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white/70">
          <Layers className="h-3.5 w-3.5 text-ink/60" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-ink">Every store is isolated.</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink/45">
            Separate keys, separate cache namespaces, separate invalidation graphs. A purge on
            one store can never touch another.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {["01", "02", "03"].map((id) => (
          <span
            key={id}
            className="flex h-8 w-11 items-center justify-center rounded border border-ink/10 bg-ink/[0.03] font-mono text-[8px] text-ink/35"
          >
            sk_{id}
          </span>
        ))}
        <span className="font-mono text-[8px] text-ink/25">→</span>
        <span className="rounded border border-emerald-600/25 bg-emerald-500/8 px-2 py-1.5 font-mono text-[8px] text-emerald-700">
          isolated
        </span>
      </div>
    </div>
  );
}
