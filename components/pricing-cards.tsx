import { Check, Layers } from "lucide-react";
import { PLANS } from "@/lib/content";
import { ConnectButton } from "@/components/connect/connect-button";
import { cn } from "@/lib/utils";

export function PricingCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
      {PLANS.map((plan) => (
        <article
          key={plan.name}
          className={cn(
            "relative flex flex-col rounded-2xl p-6 sm:p-7",
            plan.popular
              ? "border border-white/10 bg-ink text-paper shadow-[0_28px_70px_-30px_rgba(8,9,11,0.55)] lg:-mt-4 lg:mb-0 lg:pb-9"
              : "border border-ink/10 bg-white/55 text-ink",
          )}
        >
          {plan.popular && (
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
          )}

          <div className="flex items-center justify-between gap-3">
            <h3
              className={cn(
                "font-display text-[21px] font-medium tracking-[-0.03em]",
                plan.popular ? "text-paper" : "text-ink",
              )}
            >
              {plan.name}
            </h3>
            <span className={cn("chip", plan.popular && "border-white/15 text-paper/60")}>
              {plan.storeLabel}
            </span>
          </div>

          <p
            className={cn(
              "mt-2 text-[12.5px] leading-relaxed",
              plan.popular ? "text-paper/45" : "text-ink/45",
            )}
          >
            {plan.tagline}
          </p>

          <div className="mt-7 flex items-end gap-1.5">
            <span
              className={cn(
                "font-display text-[50px] leading-none tracking-[-0.05em]",
                plan.popular ? "text-paper" : "text-ink",
              )}
            >
              ${plan.price}
            </span>
            <span
              className={cn(
                "pb-1.5 text-[12px]",
                plan.popular ? "text-paper/40" : "text-ink/40",
              )}
            >
              / month
            </span>
          </div>
          <p
            className={cn(
              "mt-1.5 font-mono text-[10px]",
              plan.popular ? "text-paper/30" : "text-ink/35",
            )}
          >
            or ${plan.annual} billed yearly (${(plan.annual / 12).toFixed(2)}/mo), saving ${plan.price * 12 - plan.annual}
          </p>

          <ConnectButton
            plan={plan.name}
            variant={plan.popular ? "primary" : "outline-dark"}
            full
            className="mt-7"
          >
            Start 3-day trial
          </ConnectButton>
          <p
            className={cn(
              "mt-2.5 text-center font-mono text-[9.5px] uppercase tracking-[0.06em]",
              plan.popular ? "text-paper/25" : "text-ink/30",
            )}
          >
            3 days · no card
          </p>

          <div
            className={cn(
              "my-6 h-px",
              plan.popular ? "bg-white/10" : "bg-ink/10",
            )}
          />

          <div className="flex-1">
            <p
              className={cn(
                "font-mono text-[9px] uppercase tracking-[0.12em]",
                plan.popular ? "text-paper/35" : "text-ink/35",
              )}
            >
              {plan.events}
            </p>
            <ul className="mt-4 space-y-2.5">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <Check
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      plan.popular ? "text-mint/80" : "text-accent-deep",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[12.5px] leading-[1.5]",
                      plan.popular ? "text-paper/55" : "text-ink/55",
                    )}
                  >
                    {feature}
                  </span>
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
      ))}
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
