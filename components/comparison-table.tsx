import { Check, Minus, X } from "lucide-react";
import { COMPARISON_ROWS, type ComparisonCell } from "@/lib/content";
import { LogoMark } from "@/components/logo";

export function ComparisonTable() {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/50">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <caption className="sr-only">
              Silo compared with WP Rocket and FlyingPress on default WooCommerce cache behavior
            </caption>
            <thead>
              <tr className="border-b border-ink/10">
                <th className="w-[32%] px-5 py-5 align-bottom">
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink/35">
                    Default behavior
                  </span>
                </th>
                <th className="w-[20%] px-4 py-5 text-[12.5px] font-semibold text-ink/60">
                  WP Rocket
                </th>
                <th className="w-[20%] px-4 py-5 text-[12.5px] font-semibold text-ink/60">
                  FlyingPress
                </th>
                <th className="w-[28%] border-l border-accent/15 bg-accent/[0.07] px-4 py-4 text-ink">
                  <div className="flex items-center gap-2">
                    <LogoMark
                      onDark={false}
                      className="h-5 w-5 rounded-[5px] p-[3px]"
                    />
                    <span className="font-display text-[15px] font-semibold tracking-[-0.03em]">
                      silo
                    </span>
                    <span className="ml-auto rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.08em] text-accent-deep">
                      catalog-native
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] font-normal leading-relaxed text-ink/45">
                    WooCommerce-only cache with a product graph
                  </p>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, index) => (
                <tr
                  key={row.label}
                  className={index !== COMPARISON_ROWS.length - 1 ? "border-b border-ink/8" : ""}
                >
                  <th scope="row" className="px-5 py-4 align-top">
                    <span className="block text-[13px] font-medium text-ink">{row.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-snug text-ink/35">
                      {row.detail}
                    </span>
                  </th>
                  <Cell cell={row.rocket} />
                  <Cell cell={row.flying} />
                  <td className="bg-accent/[0.045] px-4 py-4 align-top">
                    <div className="flex items-start gap-2 text-[12px] font-medium text-ink">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-deep" />
                      {row.silo.value}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-4 max-w-[820px] text-[10.5px] leading-relaxed text-ink/35">
        Based on the default page-caching behavior of each product as of November 2026. WP Rocket
        and FlyingPress are capable, broader WordPress performance suites; both can be extended
        with manual purge rules. Silo is deliberately narrower: it does one thing, for
        WooCommerce catalogs, and does not replace asset optimization or a CDN. You can run
        Silo next to either: they keep serving pages and Silo keeps their cache accurate.
      </p>
    </div>
  );
}

function Cell({ cell }: { cell: ComparisonCell }) {
  const Icon = cell.tone === "good" ? Check : cell.tone === "mixed" ? Minus : X;

  return (
    <td className="px-4 py-4 align-top">
      <div className="flex items-start gap-2 text-[12px] text-ink/55">
        <Icon
          className={
            cell.tone === "good"
              ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-deep"
              : cell.tone === "mixed"
                ? "mt-0.5 h-3.5 w-3.5 shrink-0 text-amber"
                : "mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/20"
          }
        />
        {cell.value}
      </div>
    </td>
  );
}
