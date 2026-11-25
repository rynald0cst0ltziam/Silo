import Link from "next/link";
import { trialCarriesOver, trialEndLabel, type Access } from "@/lib/entitlements";

/**
 * Account-wide notice under the dashboard nav: trial countdown, failed payment,
 * expired trial or suspension. Silent for healthy paid and complimentary accounts.
 */
export function AccessBanner({ access, pausedStores, eventsUsed = 0 }: { access: Access; pausedStores: number; eventsUsed?: number }) {
  let tone: "info" | "warn" | "stop" | null = null;
  let text = "";
  let cta: { href: string; label: string } | null = { href: "/dashboard/billing", label: "Choose a plan" };

  switch (access.state) {
    case "trial":
      tone = access.trialDaysLeft <= 2 ? "warn" : "info";
      text = `Free trial: ${access.trialDaysLeft} day${access.trialDaysLeft === 1 ? "" : "s"} left (ends ${trialEndLabel(access)}). ${
        trialCarriesOver(access) ? "Choose a plan any time: start it today, or let billing begin when the trial ends." : "Choose a plan to keep caching on after the trial."
      }`;
      break;
    case "past_due":
      tone = "warn";
      text = access.message;
      cta = { href: "/api/billing/portal", label: "Update card" };
      break;
    case "expired":
    case "canceled":
      tone = "stop";
      text = `${access.message} Your stores are showing live pages (never stale ones) until a plan is active, then caching switches straight back on.`;
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

  // Usage warnings for accounts that are otherwise fine (or on trial, appended).
  if (access.active && (tone === null || tone === "info")) {
    const limit = access.tier.maxMonthlyEvents;
    const pct = limit ? (eventsUsed / limit) * 100 : 0;
    const now = new Date();
    const resets = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    if (pct >= 100) {
      tone = "stop";
      text = `Monthly event limit reached: ${eventsUsed.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")}. Pages are still purged on your stores, so nothing goes stale, but logging and warmup are paused until ${resets}.`;
      cta = { href: "/dashboard/billing", label: "Upgrade" };
    } else if (pct >= 80) {
      tone = "warn";
      text = `${Math.floor(pct)}% of this month's events used (${eventsUsed.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")}). Resets ${resets}.`;
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
