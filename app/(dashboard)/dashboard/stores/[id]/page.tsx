import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";
import { RegenerateKeyButton, DeleteStoreButton } from "@/components/store-actions";
import { RescanButton, PurgeAllButton } from "@/components/store-action-buttons";
import { HitRateChart } from "@/components/hit-rate-chart";
import { EventUsageMeter } from "@/components/event-usage-meter";
import { WarmupProgress } from "@/components/warmup-progress";
import { HealthIndicators } from "@/components/health-indicators";

export const metadata: Metadata = {
  title: "Store",
  robots: { index: false, follow: false },
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    optimized: "bg-mint/10 text-mint/70 border-mint/20",
    scanning: "bg-amber/10 text-amber/70 border-amber/20",
    pending: "bg-white/5 text-paper/40 border-white/10",
    error: "bg-red-500/10 text-red-400/70 border-red-500/20",
    offline: "bg-red-500/10 text-red-400/70 border-red-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export default async function StoreDetailPage({
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

  const tier = user.subscription
    ? getTier(user.subscription.tier)
    : null;

  const [recentEvents, metrics, warmupJobs] = await Promise.all([
    prisma.event.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.metric.findMany({
      where: { storeId: store.id },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.warmupJob.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const chartData = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    hits: m.hits,
    misses: m.misses,
    hitRate: m.hits + m.misses > 0 ? (m.hits / (m.hits + m.misses)) * 100 : 0,
  }));

  const warmupJobData = warmupJobs.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    total: j.total,
    createdAt: j.createdAt.toISOString(),
  }));

  const maxEvents = tier?.maxMonthlyEvents ?? 100_000;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-[11px] text-paper/30 transition hover:text-paper/60"
      >
        <ArrowLeft className="h-3 w-3" />
        All stores
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-paper">
              {store.name}
            </h1>
            <StatusBadge status={store.status} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-paper/30">
            {store.url}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RescanButton storeId={store.id} />
          <PurgeAllButton storeId={store.id} />
        </div>
      </div>

      {/* Health indicators */}
      <div className="mt-4">
        <HealthIndicators
          status={store.status}
          lastSeenAt={store.lastSeenAt?.toISOString() ?? null}
          lastEventAt={store.lastEventAt?.toISOString() ?? null}
          monthlyEvents={store.monthlyEvents}
          maxMonthlyEvents={maxEvents}
        />
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Hit rate", value: `${(store.hitRate * 100).toFixed(1)}%` },
          {
            label: "Last event",
            value: store.lastEventAt
              ? new Date(store.lastEventAt).toLocaleString()
              : "—",
          },
          {
            label: "Connector",
            value: store.lastSeenAt
              ? `Online \xb7 ${new Date(store.lastSeenAt).toLocaleTimeString()}`
              : "Not connected",
          },
          {
            label: "Config version",
            value: `v${store.configVersion}`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/8 bg-[#0b0d11] p-4"
          >
            <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
              {stat.label}
            </p>
            <p className="mt-1.5 font-mono text-[14px] text-paper/70">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Event usage meter */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <EventUsageMeter used={store.monthlyEvents} max={maxEvents} />
      </div>

      {/* Hit rate chart */}
      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h2 className="mb-3 text-[13px] font-medium text-paper/70">
          Hit rate (30 days)
        </h2>
        <HitRateChart data={chartData} />
      </div>

      {/* Warmup progress */}
      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h2 className="mb-3 text-[13px] font-medium text-paper/70">
          Recent warmup jobs
        </h2>
        <WarmupProgress jobs={warmupJobData} />
      </div>

      {/* Recent invalidations */}
      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h2 className="text-[13px] font-medium text-paper/70">
          Recent invalidations
        </h2>
        {recentEvents.length === 0 ? (
          <p className="mt-4 text-[11px] text-paper/30">
            No events recorded yet. Connect the Silo connector plugin and events will appear here.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {recentEvents.map((event) => {
              const purgeCount = Array.isArray(event.purgeUrls) ? (event.purgeUrls as string[]).length : 0;
              const warmCount = Array.isArray(event.warmUrls) ? (event.warmUrls as string[]).length : 0;

              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] text-accent/70">
                      {event.type}
                    </span>
                    {purgeCount > 0 && (
                      <span className="font-mono text-[8px] text-paper/25">
                        {purgeCount} purged
                      </span>
                    )}
                    {warmCount > 0 && (
                      <span className="font-mono text-[8px] text-mint/40">
                        {warmCount} warmed
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[8px] text-paper/25">
                    {new Date(event.createdAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Store settings */}
      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h2 className="text-[13px] font-medium text-paper/70">Store settings</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-wider text-paper/25">API key</p>
            <p className="mt-1 text-[10px] text-paper/35">
              Key prefix: <code className="text-paper/50">sk_silo_...{store.apiKeyHash.slice(-6)}</code>
            </p>
            <div className="mt-2">
              <RegenerateKeyButton storeId={store.id} />
            </div>
          </div>
          <div className="border-t border-white/6 pt-4">
            <DeleteStoreButton storeId={store.id} storeName={store.name} />
          </div>
        </div>
      </div>
    </div>
  );
}
