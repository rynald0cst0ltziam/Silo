import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { DashboardMock } from "@/components/dashboard-mock";

export function DashboardSection({ compact = false }: { compact?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="pointer-events-none absolute right-0 top-0 h-[500px] w-[500px] rounded-full bg-accent/8 blur-[130px]" />
      <div className={`container-page relative ${compact ? "section-sm" : "section"}`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-end">
          <div>
            <p className="eyebrow text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              The control room
            </p>
            <h2 className="display-tight mt-5 max-w-[630px] text-[clamp(28px,3.6vw,44px)] text-paper">
              Every purge has a paper trail.
            </h2>
            <p className="lede mt-5 max-w-[480px]">
              Hit rate, invalidation scope, warmup progress and the exact event that caused each
              change. No mystery purges, no guessing which plugin fired.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2.5 lg:justify-end lg:pb-1">
            {[
              "Per-store isolation",
              "Event-level audit log",
              "Warmup queue visibility",
            ].map((item) => (
              <span
                key={item}
                className="flex items-center gap-2 text-[11.5px] text-paper/45"
              >
                <Check className="h-3 w-3 text-mint/70" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <DashboardMock />
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-paper/20">
            Sample workspace · every number traceable to an event
          </p>
          <Link
            href="/demo"
            className="group flex items-center gap-2 text-[12px] font-medium text-paper/55 transition hover:text-paper"
          >
            Open the dashboard demo
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
