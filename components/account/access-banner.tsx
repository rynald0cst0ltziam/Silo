import Link from "next/link";
import type { Access } from "@/lib/entitlements";

/**
 * Account-wide notice under the dashboard nav: trial countdown, failed payment,
 * expired trial or suspension. Silent for healthy paid and complimentary accounts.
 */
export function AccessBanner({ access, pausedStores }: { access: Access; pausedStores: number }) {
  let tone: "info" | "warn" | "stop" | null = null;
  let text = "";
  let cta: { href: string; label: string } | null = { href: "/dashboard/billing", label: "Choose a plan" };

  switch (access.state) {
    case "trial":
      tone = access.trialDaysLeft <= 3 ? "warn" : "info";
      text = `Free trial — ${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? "" : "s"} left (ends ${access.trialEndsAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}). Pick a plan any time; the remaining trial days carry over.`;
      break;
    case "past_due":
      tone = "warn";
      text = access.message;
      cta = { href: "/api/billing/portal", label: "Update card" };
      break;
    case "expired":
    case "canceled":
      tone = "stop";
      text = `${access.message} Connected stores are serving uncached pages until then — nothing stale is ever shown.`;
      break;
    case "suspended":
      tone = "stop";
      text = access.message;
      cta = null;
      break;
    default:
      if (pausedStores > 0) {
        tone = "warn";
        text = `${pausedStores} store${pausedStores === 1 ? " is" : "s are"} over the ${access.tier.name} plan's limit of ${access.tier.maxStores} and paused. Upgrade or remove a store.`;
        cta = { href: "/dashboard/billing", label: "See plans" };
      }
  }

  if (!tone) return null;

  const styles = {
    info: "border-accent/25 bg-accent/[0.07] text-paper/80",
    warn: "border-amber/30 bg-amber/[0.08] text-paper/85",
    stop: "border-red-500/30 bg-red-500/[0.08] text-paper/90",
  }[tone];

  return (
    <div className={`border-b ${styles}`} role={tone === "info" ? "status" : "alert"}>
      <div className="container-page flex flex-wrap items-center justify-between gap-3 py-2.5">
        <p className="text-[14px] leading-snug">{text}</p>
        {cta ? (
          <Link href={cta.href} className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-paper transition hover:bg-white/15">
            {cta.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
