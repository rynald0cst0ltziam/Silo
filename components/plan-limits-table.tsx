import { TIERS, type TierSlug } from "@/lib/tiers";
import { TRIAL_DAYS } from "@/lib/entitlements";

const ORDER: TierSlug[] = ["solo", "studio", "portfolio"];

/**
 * Every limit per plan, rendered from lib/tiers.ts, the same numbers the server enforces.
 */
export function PlanLimitsTable({ tone = "light", current }: { tone?: "light" | "dark"; current?: TierSlug | null }) {
  const dark = tone === "dark";
  const rows: Array<{ label: string; detail: string; value: (slug: TierSlug) => string }> = [
    { label: "Stores", detail: "WooCommerce installs, each with its own key and cache", value: (s) => String(TIERS[s].maxStores) },
    {
      label: "Catalog events per month",
      detail: "Shared by all stores on the account; resets on the 1st (UTC)",
      value: (s) => TIERS[s].maxMonthlyEvents.toLocaleString("en-US"),
    },
    { label: "Warmup per event", detail: "Pages rewarmed after each change, desktop and mobile", value: (s) => `${TIERS[s].warmupUrlsPerEvent} URLs` },
    { label: "Daily priority warmup", detail: "Bestsellers, shop and top categories every morning", value: (s) => `${TIERS[s].warmupUrlsPerEvent} URLs` },
    { label: "Log retention", detail: "Invalidation, warmup and metrics history", value: (s) => `${TIERS[s].logRetentionDays} days` },
    { label: "Price", detail: "Monthly, or annual with 2 months free", value: (s) => `$${TIERS[s].priceMonthly}/mo · $${TIERS[s].priceAnnual}/yr` },
  ];

  const head = dark ? "bg-white/[0.03] text-paper/50" : "bg-ink/[0.03] text-ink/50";
  const cell = dark ? "text-paper/85" : "text-ink/80";
  const sub = dark ? "text-paper/45" : "text-ink/45";
  const border = dark ? "border-white/8 divide-white/[0.06]" : "border-ink/10 divide-ink/[0.07]";

  return (
    <div>
      <div className={`overflow-x-auto border ${border}`}>
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <caption className="sr-only">Limits for each Silo plan</caption>
          <thead className={`text-[12px] uppercase tracking-wider ${head}`}>
            <tr>
              <th className="px-4 py-3 font-medium">Limit</th>
              {ORDER.map((s) => (
                <th key={s} className={`px-4 py-3 font-medium ${current === s ? "text-accent" : ""}`}>
                  {TIERS[s].name}
                  {current === s ? " (yours)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${border}`}>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row" className="px-4 py-3 align-top font-normal">
                  <span className={`block font-medium ${cell}`}>{row.label}</span>
                  <span className={`mt-0.5 block text-[12.5px] ${sub}`}>{row.detail}</span>
                </th>
                {ORDER.map((s) => (
                  <td key={s} className={`px-4 py-3 align-top font-mono text-[13.5px] ${cell}`}>
                    {row.value(s)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`mt-3 text-[13px] leading-relaxed ${sub}`}>
        An event is one catalog change Silo plans for: a stock change, price or sale change, product edit, order, refund,
        review or category change. Page views, cache hits and warmup fetches never count. If the monthly allowance runs out,
        pages are still purged on your store, so nothing goes stale; only logging and warmup pause until the 1st or an
        upgrade. The {TRIAL_DAYS}-day trial uses Solo limits.
      </p>
    </div>
  );
}
