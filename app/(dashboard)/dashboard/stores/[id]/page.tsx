import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";
import { RescanButton, PurgeAllButton } from "@/components/store-action-buttons";
import { HitRateChart } from "@/components/hit-rate-chart";
import { EventUsageMeter } from "@/components/event-usage-meter";
import { WarmupQueuePanel } from "@/components/warmup-queue-panel";
import { HealthIndicators } from "@/components/health-indicators";
import { InvalidationLogTable } from "@/components/invalidation-log-table";

export const metadata: Metadata = {
  title: "Store Overview",
  robots: { index: false, follow: false },
};

export default async function StoreOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
  });

  if (!store) notFound();

  const tier = user.subscription ? getTier(user.subscription.tier) : null;

  const [recentEvents, metrics, warmupJobs] = await Promise.all([
    prisma.event.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.metric.findMany({
      where: { storeId: store.id },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.warmupJob.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const chartData = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    hits: m.hits,
    misses: m.misses,
    hitRate:
      m.hits + m.misses > 0 ? (m.hits / (m.hits + m.misses)) * 100 : 0,
  }));

  const maxEvents = tier?.maxMonthlyEvents ?? 100_000;

  // 24h invalidation count
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentInvalidations = recentEvents.filter(
    (e) => new Date(e.createdAt) >= twentyFourHoursAgo
  );

  // Active warmup jobs
  const activeWarmups = warmupJobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  );
  const totalWarmupUrls = activeWarmups.reduce((s, j) => s + j.total, 0);

  // Event data for log table
  const eventLogData = recentEvents.slice(0, 20).map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload as Record<string, unknown> | null,
    purgeUrls: Array.isArray(e.purgeUrls) ? (e.purgeUrls as string[]) : [],
    warmUrls: Array.isArray(e.warmUrls) ? (e.warmUrls as string[]) : [],
    processed: e.processed,
    createdAt: e.createdAt.toISOString(),
  }));

  // Warmup job data for queue panel
  const warmupData = warmupJobs.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    total: j.total,
    urls: Array.isArray(j.urls) ? (j.urls as string[]).slice(0, 10) : [],
    createdAt: j.createdAt.toISOString(),
  }));

  return (
    <div>
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-paper">
            Overview
          </h2>
          <p className="mt-0.5 font-mono text-[9px] text-paper/25">
            {store.url} · last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RescanButton storeId={store.id} />
          <PurgeAllButton storeId={store.id} />
        </div>
      </div>

      {/* Health indicators */}
      <div className="mt-3">
        <HealthIndicators
          status={store.status}
          lastSeenAt={store.lastSeenAt?.toISOString() ?? null}
          lastEventAt={store.lastEventAt?.toISOString() ?? null}
          monthlyEvents={store.monthlyEvents}
          maxMonthlyEvents={maxEvents}
        />
      </div>

      {/* KPI cards — matching marketing mock */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Hit rate"
          value={`${(store.hitRate * 100).toFixed(1)}%`}
          delta={
            chartData.length >= 2
              ? `${(chartData[chartData.length - 1].hitRate - chartData[chartData.length - 2].hitRate).toFixed(1)} pts`
              : "—"
          }
          deltaType="positive"
        />
        <KpiCard
          label="Median TTFB"
          value={store.status === "optimized" ? "< 50ms" : "—"}
          delta="vs origin"
          deltaType="positive"
        />
        <KpiCard
          label="Invalidations"
          value={recentInvalidations.length.toLocaleString()}
          delta="last 24h"
          deltaType="neutral"
        />
        <KpiCard
          label="Warmup queue"
          value={String(totalWarmupUrls)}
          delta={`${activeWarmups.length} active`}
          deltaType="warm"
        />
      </div>

      {/* Event usage */}
      <div className="mt-3 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <EventUsageMeter used={store.monthlyEvents} max={maxEvents} />
      </div>

      {/* Chart + Warmup queue side by side */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-paper/65">
              Cache hit rate
            </p>
            <div className="flex items-center gap-2 font-mono text-[8px] text-paper/30">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                silo
              </span>
              {chartData.length > 0 && (
                <span className="text-paper/40">
                  {chartData[chartData.length - 1].hitRate.toFixed(1)}% avg
                </span>
              )}
            </div>
          </div>
          <div className="mt-2">
            <HitRateChart data={chartData} />
          </div>
        </div>

        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <WarmupQueuePanel jobs={warmupData} />
        </div>
      </div>

      {/* Invalidation log table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="text-[11px] font-medium text-paper/65">
            Recent invalidations
          </p>
          <span className="flex items-center gap-1 font-mono text-[8px] text-paper/25">
            Live log
          </span>
        </div>
        <InvalidationLogTable events={eventLogData} />
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaType,
}: {
  label: string;
  value: string;
  delta: string;
  deltaType: "positive" | "neutral" | "warm";
}) {
  const deltaColor =
    deltaType === "positive"
      ? "text-mint/65"
      : deltaType === "warm"
        ? "text-amber/65"
        : "text-paper/25";

  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3 py-3">
      <p className="font-mono text-[7px] uppercase tracking-[0.09em] text-paper/25">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-[22px] font-semibold leading-none tracking-tight text-paper">
        {value}
      </p>
      <p className={`mt-1.5 font-mono text-[7px] ${deltaColor}`}>{delta}</p>
    </div>
  );
}
