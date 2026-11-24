import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Status",
  description: "Live status for the Silo edge, connector API, invalidation workers and dashboard.",
  alternates: { canonical: "/status" },
};

const SERVICES = [
  "Storefront edge",
  "Connector API",
  "Invalidation workers",
  "Store API mapping",
  "Warmup queue",
  "Dashboard",
  "Billing",
];

export default function StatusPage() {
  return (
    <div className="bg-[#07080a]">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
        <div className="container-page relative py-12 text-center sm:py-16">
          <p className="eyebrow justify-center text-paper/35">
            <span className="pulse-dot" />
            Silo status
          </p>
          <h1 className="display mt-5 text-[clamp(32px,4.2vw,46px)] text-paper">
            All systems operational.
          </h1>
          <p className="mt-4 text-[13px] text-paper/40">
            Status as of November 16, 2026 · reviewed daily.
          </p>
        </div>
      </section>

      <div className="container-page py-10 sm:py-12">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { value: "99.99%", label: "Uptime · last 90 days" },
            { value: "42ms", label: "Median edge invalidation" },
            { value: "0", label: "Open incidents" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-white/9 bg-white/[0.02] p-5">
              <p className="font-display text-[30px] leading-none tracking-[-0.04em] text-paper">
                {metric.value}
              </p>
              <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.08em] text-paper/30">
                {metric.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-white/9 bg-[#0b0d11]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-3.5">
            <p className="text-[12px] font-medium text-paper/70">Platform services</p>
            <div className="flex items-center gap-4 font-mono text-[7.5px] uppercase tracking-[0.06em] text-paper/25">
              <span>90 days ago</span>
              <span>today</span>
            </div>
          </div>

          {SERVICES.map((service) => (
            <div
              key={service}
              className="grid items-center gap-3 border-b border-white/5 px-5 py-3 last:border-0 sm:grid-cols-[170px_1fr_86px]"
            >
              <span className="text-[11.5px] text-paper/60">{service}</span>
              <div className="flex h-5 gap-[2px]" aria-hidden="true">
                {Array.from({ length: 60 }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-full flex-1 rounded-[1px] ${
                      index === 37 ? "bg-mint/25" : "bg-mint/55"
                    }`}
                  />
                ))}
              </div>
              <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.06em] text-mint/65 sm:justify-end">
                <Check className="h-2.5 w-2.5" />
                Operational
              </span>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 px-5 py-3 font-mono text-[7px] uppercase tracking-[0.06em] text-paper/20">
            <span>60 checks per day · 5 regions</span>
            <span>99.99% · 90-day rolling</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-white/9 bg-[#0b0d11] p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-paper/70">Incident history</p>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-paper/25">
                Last 90 days
              </span>
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-mint/15 bg-mint/[0.04] p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-mint/25 bg-mint/10">
                <Check className="h-4 w-4 text-mint" />
              </span>
              <div>
                <p className="text-[12.5px] font-medium text-paper/75">No incidents reported.</p>
                <p className="mt-0.5 text-[10.5px] text-paper/35">
                  Every scheduled invalidation event has completed within its target window.
                </p>
              </div>
            </div>
            <p className="mt-4 font-mono text-[8px] leading-relaxed text-paper/20">
              One brief edge deploy window on Sep 2, 2026 (04:00–04:06 UTC). No missed
              invalidations; connector heartbeats buffered and replayed.
            </p>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-white/9 bg-[#0b0d11] p-5">
            <div>
              <Mail className="h-4 w-4 text-accent-hi" />
              <p className="mt-3 text-[12px] font-medium text-paper/70">Get incident updates</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-paper/35">
                Email support and we&apos;ll add your address to the incident list. No marketing.
              </p>
            </div>
            <a
              href="mailto:support@heysilo.co?subject=Status%20updates"
              className="btn btn-secondary btn-sm mt-5 w-full"
            >
              support@heysilo.co
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 text-[10.5px] text-paper/30">
          <p>Silo status covers the edge, connector API, invalidation and warmup pipeline.</p>
          <Link href="/docs" className="transition hover:text-paper/60">
            Connector troubleshooting →
          </Link>
        </div>
      </div>
    </div>
  );
}
