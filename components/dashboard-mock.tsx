import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Download,
  Flame,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Counter } from "@/components/counter";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutDashboard, label: "Overview", active: true },
  { icon: Package, label: "Catalog" },
  { icon: Zap, label: "Invalidations" },
  { icon: Flame, label: "Warmup" },
  { icon: Settings2, label: "Settings" },
];

const EVENTS = [
  {
    trigger: "stock.changed",
    object: "Aster Linen Shirt",
    detail: "olive / m · SKU-1042",
    scope: "3 URLs · 1 route",
    duration: "42ms",
    state: "Re-warmed",
  },
  {
    trigger: "price.updated",
    object: "Coast Runner",
    detail: "sand / 42 · SKU-2088",
    scope: "2 URLs",
    duration: "38ms",
    state: "Re-warmed",
  },
  {
    trigger: "category.updated",
    object: "Summer linen",
    detail: "category · 46 products",
    scope: "1 archive",
    duration: "61ms",
    state: "Re-warmed",
  },
  {
    trigger: "order.refunded",
    object: "Field Tote",
    detail: "natural · SKU-3310",
    scope: "2 URLs",
    duration: "47ms",
    state: "Warming",
  },
];

export function DashboardMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-white/10 bg-[#0a0c10] text-paper shadow-[0_40px_110px_-40px_rgba(0,0,0,0.9)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-3.5 py-2.5">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-6 w-6 rounded-[6px] p-[3px]" />
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-paper/80">Aurora Supply Co.</span>
            <ChevronDown className="h-3 w-3 text-paper/30" />
          </div>
          <span className="hidden items-center gap-1 rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.06em] text-mint/80 sm:flex">
            <span className="pulse-dot h-1 w-1" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden h-7 w-[132px] items-center gap-1.5 rounded border border-white/8 bg-white/[0.02] px-2 sm:flex">
            <Search className="h-3 w-3 text-paper/25" />
            <span className="text-[8.5px] text-paper/25">Search SKU, URL…</span>
            <span className="ml-auto rounded border border-white/8 px-1 font-mono text-[7px] text-paper/25">
              ⌘K
            </span>
          </div>
          <span className="rounded border border-white/8 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.06em] text-paper/25">
            Sample data
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-accent/15 font-mono text-[8px] text-accent-hi">
            EM
          </span>
        </div>
      </div>

      <div className="flex">
        <aside className="hidden w-[158px] shrink-0 flex-col justify-between border-r border-white/8 bg-[#090b0f] p-2.5 md:flex">
          <nav className="space-y-0.5" aria-label="Dashboard preview navigation">
            {NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-[7px] text-[9.5px]",
                  item.active
                    ? "bg-accent/10 text-accent-hi"
                    : "text-paper/35",
                )}
              >
                <item.icon className="h-3 w-3" />
                {item.label}
                {item.label === "Warmup" && (
                  <span className="ml-auto rounded bg-amber/15 px-1 font-mono text-[7px] text-amber">
                    6
                  </span>
                )}
              </div>
            ))}
          </nav>

          <div className="mt-6 rounded-md border border-white/8 bg-white/[0.02] p-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-paper/25">
                Store key
              </span>
              <ShieldCheck className="h-2.5 w-2.5 text-mint/60" />
            </div>
            <p className="mt-1.5 font-mono text-[7.5px] tracking-[0.05em] text-paper/40">
              sk_silo_•••••9f2a
            </p>
            <p className="mt-1 font-mono text-[6.5px] text-paper/20">connector v0.9.0</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1 p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-[16px] tracking-[-0.025em] text-paper">Overview</h3>
              <p className="mt-0.5 font-mono text-[7.5px] text-paper/25">
                aurora-supply.com · last 24 hours
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded border border-white/9 px-1.5 py-1 font-mono text-[7.5px] text-paper/40">
                Last 24h
                <ChevronDown className="h-2 w-2" />
              </span>
              <span className="flex h-6 w-6 items-center justify-center rounded border border-white/9">
                <Download className="h-2.5 w-2.5 text-paper/35" />
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi
              label="Hit rate"
              value={99.4}
              decimals={1}
              suffix="%"
              delta="+1.2 pts"
              positive
            />
            <Kpi label="Median TTFB" value={38} suffix="ms" delta="-68% vs origin" positive />
            <Kpi label="Invalidations" value={1284} delta="last 24h" />
            <Kpi label="Warmup queue" value={6} delta="2 high priority" warm />
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-[1.55fr_1fr]">
            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[9.5px] font-medium text-paper/65">Cache hit rate</p>
                <div className="flex items-center gap-2 font-mono text-[7px] text-paper/30">
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    silo
                  </span>
                  <span className="text-paper/40">99.4% avg</span>
                </div>
              </div>

              <div className="relative mt-3">
                <svg
                  viewBox="0 0 600 120"
                  preserveAspectRatio="none"
                  className="h-[104px] w-full sm:h-[116px]"
                  role="img"
                  aria-label="Cache hit rate over the last 24 hours, holding between 98 and 100 percent"
                >
                  <defs>
                    <linearGradient id="silo-hit-gradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3d6bff" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#3d6bff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[24, 54, 84].map((y) => (
                    <line
                      key={y}
                      x1="0"
                      y1={y}
                      x2="600"
                      y2={y}
                      stroke="rgba(255,255,255,0.045)"
                      strokeWidth="1"
                    />
                  ))}
                  <path
                    d="M0 82 C35 80 52 88 82 72 C112 57 132 64 162 58 C195 51 214 66 248 47 C280 29 300 42 334 34 C366 27 388 42 420 28 C450 16 474 27 505 20 C536 13 566 22 600 12 L600 120 L0 120 Z"
                    fill="url(#silo-hit-gradient)"
                  />
                  <path
                    d="M0 82 C35 80 52 88 82 72 C112 57 132 64 162 58 C195 51 214 66 248 47 C280 29 300 42 334 34 C366 27 388 42 420 28 C450 16 474 27 505 20 C536 13 566 22 600 12"
                    fill="none"
                    stroke="#3d6bff"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <circle cx="600" cy="12" r="3" fill="#6389ff" />
                </svg>
                <div className="mt-1 flex justify-between font-mono text-[6.5px] text-paper/20">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[9.5px] font-medium text-paper/65">Warmup queue</p>
                <span className="font-mono text-[7px] text-amber/70">6 active</span>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { url: "/product/aster-linen-shirt", pct: 82, tone: "accent" },
                  { url: "/category/shirts", pct: 54, tone: "accent" },
                  { url: "/products?category=new", pct: 26, tone: "mint" },
                ].map((item) => (
                  <div key={item.url}>
                    <div className="flex items-center justify-between gap-2 font-mono text-[6.5px]">
                      <span className="truncate text-paper/35">{item.url}</span>
                      <span className="text-paper/25">{item.pct}%</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/6">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.tone === "accent" ? "bg-accent/80" : "bg-mint/70",
                        )}
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2 font-mono text-[6.5px]">
                <span className="text-paper/20">avg 1.4s / URL</span>
                <span className="text-paper/30">5 workers</span>
              </div>
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-lg border border-white/8 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
              <p className="text-[9.5px] font-medium text-paper/65">Recent invalidations</p>
              <span className="flex items-center gap-1 font-mono text-[6.5px] text-paper/25">
                Live log
                <MoreHorizontal className="h-2.5 w-2.5" />
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left">
                <thead>
                  <tr className="border-b border-white/7 font-mono text-[6.5px] uppercase tracking-[0.08em] text-paper/20">
                    <th className="px-3 py-1.5 font-normal">Trigger</th>
                    <th className="px-3 py-1.5 font-normal">Object</th>
                    <th className="hidden px-3 py-1.5 font-normal sm:table-cell">Scope</th>
                    <th className="hidden px-3 py-1.5 font-normal md:table-cell">Duration</th>
                    <th className="px-3 py-1.5 text-right font-normal">State</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENTS.map((event) => (
                    <tr
                      key={`${event.trigger}-${event.object}`}
                      className="border-b border-white/5 last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-[7.5px] text-accent-hi/80">
                        {event.trigger}
                      </td>
                      <td className="px-3 py-1.5">
                        <p className="whitespace-nowrap text-[8px] text-paper/60">
                          {event.object}
                        </p>
                        <p className="font-mono text-[6.5px] text-paper/20">{event.detail}</p>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 font-mono text-[7px] text-paper/30 sm:table-cell">
                        {event.scope}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-1.5 font-mono text-[7px] text-paper/30 md:table-cell">
                        {event.duration}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[6.5px]",
                            event.state === "Warming"
                              ? "border-amber/20 bg-amber/8 text-amber/80"
                              : "border-mint/20 bg-mint/8 text-mint/75",
                          )}
                        >
                          {event.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  decimals = 0,
  suffix = "",
  delta,
  positive,
  warm,
}: {
  label: string;
  value: number;
  decimals?: number;
  suffix?: string;
  delta: string;
  positive?: boolean;
  warm?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-2.5 py-2.5">
      <p className="font-mono text-[6.5px] uppercase tracking-[0.09em] text-paper/25">
        {label}
      </p>
      <p className="mt-1 font-display text-[20px] leading-none tracking-[-0.04em] text-paper">
        <Counter value={value} decimals={decimals} suffix={suffix} />
      </p>
      <p
        className={cn(
          "mt-1.5 flex items-center gap-0.5 font-mono text-[6.5px]",
          positive ? "text-mint/65" : warm ? "text-amber/65" : "text-paper/25",
        )}
      >
        {positive ? (
          <ArrowDownRight className="h-2 w-2" />
        ) : warm ? (
          <ArrowUpRight className="h-2 w-2" />
        ) : null}
        {delta}
      </p>
    </div>
  );
}
