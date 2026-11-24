import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Check, Mail, X } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Status",
  description: "Live status of the Silo connector API, invalidation pipeline, warmup queue, scheduled jobs and billing.",
  alternates: { canonical: "/status" },
};

// Re-checked at most once a minute; every number below is measured, none is typed in.
export const revalidate = 60;

type State = "ok" | "degraded" | "down";
type ServiceCheck = { name: string; state: State; detail: string };

const ONLINE_MS = 150_000;

async function measure(): Promise<{ checks: ServiceCheck[]; checkedAt: Date }> {
  const checks: ServiceCheck[] = [];
  const now = Date.now();

  let dbOk = false;
  const started = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    dbOk = true;
    checks.push({ name: "Database", state: "ok", detail: `Responding in ${Date.now() - started} ms` });
  } catch {
    checks.push({ name: "Database", state: "down", detail: "Not responding" });
  }

  if (!dbOk) {
    for (const name of ["Connector API", "Invalidation", "Warmup queue", "Scheduled jobs"]) {
      checks.push({ name, state: "down", detail: "Unavailable while the database is down" });
    }
  } else {
    const [installed, online, events, stuck, lastWarmCron] = await Promise.all([
      prisma.store.count({ where: { lastSeenAt: { not: null } } }),
      prisma.store.count({ where: { lastSeenAt: { gte: new Date(now - ONLINE_MS) } } }),
      prisma.event.aggregate({ where: { createdAt: { gte: new Date(now - 3_600_000) } }, _count: true, _avg: { durationMs: true } }),
      prisma.warmupJob.count({ where: { status: { in: ["pending", "running"] }, createdAt: { lt: new Date(now - 30 * 60_000) } } }),
      prisma.cronRun.findFirst({ where: { name: "warmup" }, orderBy: { createdAt: "desc" } }),
    ]);

    checks.push({
      name: "Connector API",
      state: "ok",
      detail: installed ? `${online} of ${installed} connected stores checked in within the last 2.5 minutes` : "Accepting connector requests",
    });

    const avg = Math.round(events._avg.durationMs ?? 0);
    checks.push({
      name: "Invalidation",
      state: avg > 2000 ? "degraded" : "ok",
      detail: events._count ? `${events._count.toLocaleString()} events in the last hour · ${avg} ms average planning time` : "No catalog events in the last hour",
    });

    checks.push({
      name: "Warmup queue",
      state: stuck > 5 ? "degraded" : "ok",
      detail: stuck ? `${stuck} job${stuck === 1 ? "" : "s"} waiting longer than 30 minutes` : "No jobs waiting longer than 30 minutes",
    });

    const age = lastWarmCron ? now - lastWarmCron.createdAt.getTime() : null;
    checks.push({
      name: "Scheduled jobs",
      state: !lastWarmCron ? "degraded" : !lastWarmCron.ok || (age ?? 0) > 20 * 60_000 ? "degraded" : "ok",
      detail: !lastWarmCron
        ? "No scheduled run recorded yet"
        : `Last warmup run ${Math.round((age ?? 0) / 60_000)} min ago${lastWarmCron.ok ? "" : " (failed)"}`,
    });
  }

  const billing = !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
  checks.push({ name: "Billing", state: billing ? "ok" : "degraded", detail: billing ? "Checkout and subscription sync configured" : "Billing is being configured" });
  checks.push({ name: "Dashboard", state: "ok", detail: "Serving pages" });

  return { checks, checkedAt: new Date() };
}

const STYLE: Record<State, { label: string; text: string; icon: typeof Check }> = {
  ok: { label: "Operational", text: "text-mint", icon: Check },
  degraded: { label: "Degraded", text: "text-amber", icon: AlertTriangle },
  down: { label: "Down", text: "text-red-300", icon: X },
};

export default async function StatusPage() {
  const { checks, checkedAt } = await measure();
  const worst: State = checks.some((c) => c.state === "down") ? "down" : checks.some((c) => c.state === "degraded") ? "degraded" : "ok";
  const headline = worst === "ok" ? "All systems operational." : worst === "degraded" ? "Some systems are degraded." : "Part of Silo is down.";

  return (
    <div className="bg-[#07080a]">
      <section className="relative overflow-hidden border-b border-white/8">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
        <div className="container-page relative py-12 text-center sm:py-16">
          <p className="eyebrow justify-center text-paper/40">
            <span className="pulse-dot" />
            Silo status
          </p>
          <h1 className="display mt-5 text-[clamp(30px,3.8vw,42px)] text-paper">{headline}</h1>
          <p className="mt-4 text-[14px] text-paper/50">
            Checked live at {checkedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC · refreshes every minute
          </p>
        </div>
      </section>

      <div className="container-page py-10 sm:py-12">
        <div className="overflow-hidden border border-white/9 bg-[#0b0d11]">
          <div className="border-b border-white/8 px-5 py-3.5">
            <p className="text-[14px] font-medium text-paper/80">Platform services</p>
          </div>
          {checks.map((check) => {
            const style = STYLE[check.state];
            return (
              <div key={check.name} className="grid items-center gap-2 border-b border-white/5 px-5 py-3.5 last:border-0 sm:grid-cols-[180px_1fr_130px]">
                <span className="text-[14px] text-paper/80">{check.name}</span>
                <span className="text-[13px] text-paper/50">{check.detail}</span>
                <span className={`flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.06em] sm:justify-end ${style.text}`}>
                  <style.icon className="h-3.5 w-3.5" />
                  {style.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="border border-white/9 bg-[#0b0d11] p-5">
            <p className="text-[14px] font-medium text-paper/80">Your store keeps working if Silo does not</p>
            <p className="mt-2 text-[14px] leading-relaxed text-paper/55">
              The connector purges changed pages on your own server first, so stock and prices stay
              correct even while Silo is unreachable. Events are queued and sent when the connection
              returns. If the connector cannot verify its key, it stops serving cached pages and
              your store shows live pages instead.
            </p>
          </div>

          <div className="flex flex-col justify-between border border-white/9 bg-[#0b0d11] p-5">
            <div>
              <Mail className="h-4 w-4 text-accent-hi" />
              <p className="mt-3 text-[14px] font-medium text-paper/80">Report a problem</p>
              <p className="mt-1 text-[13px] leading-relaxed text-paper/50">
                Include the store URL and, if you can, the diagnostics file from WooCommerce → Silo → Status.
              </p>
            </div>
            <a href="mailto:support@heysilo.co?subject=Status" className="btn btn-secondary btn-sm mt-5 w-full">
              support@heysilo.co
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5 text-[13px] text-paper/40">
          <p>Status covers the connector API, invalidation, warmup, scheduled jobs and billing.</p>
          <Link href="/docs" className="transition hover:text-paper/70">
            Connector troubleshooting →
          </Link>
        </div>
      </div>
    </div>
  );
}
