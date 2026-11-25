import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Info,
  LockKeyhole,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { DashboardMock } from "@/components/dashboard-mock";
import { ConnectButton } from "@/components/connect/connect-button";

export const metadata: Metadata = {
  title: "Demo",
  description: "A sample Silo workspace with invalidation logs, hit rate and warmup status.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <div className="bg-[#07080a]">
      <div className="border-b border-amber/15 bg-amber/[0.05]">
        <div className="container-page flex h-9 items-center gap-2 text-[10.5px] text-amber/75">
          <Info className="h-3 w-3 shrink-0" />
          <span className="truncate">
            Sample workspace — no store is connected. All figures are demo data.
          </span>
          <Link
            href="/"
            className="ml-auto hidden shrink-0 items-center gap-1 transition hover:text-amber sm:flex"
          >
            Exit demo
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="container-page py-7 sm:py-9">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-paper/25">
              Workspace / Overview
            </p>
            <h1 className="display-tight mt-2 text-[30px] text-paper sm:text-[36px]">
              Aurora Supply Co.
            </h1>
            <p className="mt-1 flex items-center gap-2 font-mono text-[9px] text-paper/30">
              aurora-supply.com
              <span className="h-3 w-px bg-white/10" />
              <span className="flex items-center gap-1.5 text-mint/60">
                <span className="pulse-dot h-1 w-1" />
                Connector online
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/docs" className="btn btn-secondary btn-sm">
              How this works
            </Link>
            <ConnectButton size="sm">Connect your store</ConnectButton>
          </div>
        </div>

        <DashboardMock className="mt-6" />

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-xl border border-white/9 bg-[#0b0d11] p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/12 ring-1 ring-accent/20">
                  <Zap className="h-3 w-3 text-accent-hi" />
                </span>
                <span className="font-mono text-[9px] text-paper/65">Event detail</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[8px] text-paper/25">01JCF8Q3M4</span>
                <span className="rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[7.5px] text-mint/70">
                  complete
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-2.5">
                {[
                  ["Trigger", "stock.changed"],
                  ["Product", "Aster Linen Shirt"],
                  ["Variation", "olive / m"],
                  ["Stock", "6 → 0"],
                  ["Scope", "3 URLs · 2 categories · 1 API key"],
                  ["Duration", "42ms"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2 last:border-0"
                  >
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-paper/25">
                      {label}
                    </span>
                    <span className="text-right font-mono text-[8.5px] text-paper/55">{value}</span>
                  </div>
                ))}
              </div>

              <pre className="code-block text-[9.5px] leading-[1.75]">
{`{
  "event": "stock.changed",
  "store": "aurora",
  "product": 1042,
  "variation": "olive/md",
  "stock": { "from": 6, "to": 0 },
  "scope": [
    "product:1042",
    "archive:shirts",
    "store-api:3f91"
  ]
}`}
              </pre>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-white/9 bg-[#0b0d11] p-5">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-mint/70" />
                <p className="text-[12px] font-medium text-paper/75">Session boundary</p>
              </div>
              <div className="mt-4 space-y-2">
                {["Cart fragments", "Checkout / nonces", "My account"].map((item) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded border border-white/7 bg-white/[0.02] px-2.5 py-2"
                  >
                    <span className="text-[10.5px] text-paper/50">{item}</span>
                    <span className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-amber/60">
                      bypass
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
              <span className="font-mono text-[8px] text-paper/25">Shared responses</span>
              <span className="flex items-center gap-1 font-mono text-[8px] text-mint/65">
                <LockKeyhole className="h-2.5 w-2.5" />0
              </span>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {[
            {
              href: "/how-it-works",
              title: "How the graph works",
              body: "Scan, invalidation and warmup, end to end.",
            },
            {
              href: "/docs",
              title: "Connect a real store",
              body: "Install the connector and run the first scan.",
            },
            {
              href: "/pricing",
              title: "Pick a plan",
              body: "1, 3 or 5 isolated stores. 7-day trial.",
            },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 transition hover:border-white/16 hover:bg-white/[0.04]"
            >
              <div>
                <p className="text-[12px] font-medium text-paper/70">{card.title}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-paper/30">{card.body}</p>
              </div>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-paper/25 transition group-hover:translate-x-0.5 group-hover:text-paper/60" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
