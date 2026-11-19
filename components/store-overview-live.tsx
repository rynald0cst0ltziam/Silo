"use client";

import { useState, useEffect, useCallback } from "react";
import { HitRateChart } from "@/components/hit-rate-chart";
import { EventUsageMeter } from "@/components/event-usage-meter";
import { WarmupQueuePanel } from "@/components/warmup-queue-panel";
import { HealthIndicators } from "@/components/health-indicators";
import { InvalidationLogTable } from "@/components/invalidation-log-table";
import { CachedUrlsPanel } from "@/components/cached-urls-panel";
import { RescanButton, PurgeAllButton } from "@/components/store-action-buttons";
import { RefreshCw } from "lucide-react";

interface OverviewData {
  store: {
    id: string;
    url: string;
    status: string;
    hitRate: number;
    monthlyEvents: number;
    lastSeenAt: string | null;
    lastEventAt: string | null;
  };
  chartData: Array<{
    date: string;
    hits: number;
    misses: number;
    hitRate: number;
  }>;
  maxEvents: number;
  recentInvalidationCount: number;
  activeWarmupCount: number;
  totalWarmupUrls: number;
  eventLogData: Array<{
    id: string;
    type: string;
    payload: Record<string, unknown> | null;
    purgeUrls: string[];
    warmUrls: string[];
    processed: boolean;
    createdAt: string;
  }>;
  warmupData: Array<{
    id: string;
    status: string;
    progress: number;
    total: number;
    urls: string[];
    createdAt: string;
  }>;
}

const POLL_INTERVAL = 15_000;

export function StoreOverviewLive({
  storeId,
  initialData,
}: {
  storeId: string;
  initialData: OverviewData;
}) {
  const [data, setData] = useState<OverviewData>(initialData);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/stores/${storeId}/overview`);
      if (response.ok) {
        const json = await response.json();
        setData(json);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // Silently retry on next interval
    }
  }, [storeId]);

  useEffect(() => {
    setLastUpdated(new Date().toLocaleTimeString());
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

  const { store, chartData, maxEvents, eventLogData, warmupData } = data;

  const lastDelta =
    chartData.length >= 2
      ? `${(chartData[chartData.length - 1].hitRate - chartData[chartData.length - 2].hitRate).toFixed(1)} pts`
      : "—";

  return (
    <div>
      {/* Header with actions */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-paper">
            Overview
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-paper/25">
            {store.url} · last 24 hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-paper/60 transition hover:bg-white/[0.06] hover:text-paper/80 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <RescanButton storeId={store.id} />
          <PurgeAllButton storeId={store.id} />
        </div>
      </div>

      {/* Live indicator */}
      <div className="mt-2 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-mint/70" />
        </span>
        <span className="font-mono text-[10px] text-paper/25" suppressHydrationWarning>
          Auto-refresh every 15s{lastUpdated ? ` · updated ${lastUpdated}` : ""}
        </span>
      </div>

      {/* Health indicators */}
      <div className="mt-3">
        <HealthIndicators
          status={store.status}
          lastSeenAt={store.lastSeenAt}
          lastEventAt={store.lastEventAt}
          monthlyEvents={store.monthlyEvents}
          maxMonthlyEvents={maxEvents}
        />
      </div>

      {/* KPI cards */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Hit rate"
          value={`${(store.hitRate * 100).toFixed(1)}%`}
          delta={lastDelta}
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
          value={data.recentInvalidationCount.toLocaleString()}
          delta="last 24h"
          deltaType="neutral"
        />
        <KpiCard
          label="Warmup queue"
          value={String(data.totalWarmupUrls)}
          delta={`${data.activeWarmupCount} active`}
          deltaType="warm"
        />
      </div>

      {/* Event usage */}
      <div className="mt-3 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <EventUsageMeter used={store.monthlyEvents} max={maxEvents} />
      </div>

      {/* Chart + Warmup queue */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-paper/65">
              Cache hit rate
            </p>
            <div className="flex items-center gap-2 font-mono text-[10px] text-paper/30">
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

      {/* Cache inspection */}
      <div className="mt-3 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <CachedUrlsPanel storeId={store.id} />
      </div>

      {/* Invalidation log */}
      <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="text-[13px] font-medium text-paper/65">
            Recent invalidations
          </p>
          <span className="flex items-center gap-1 font-mono text-[10px] text-paper/25">
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
      <p className="font-mono text-[9px] uppercase tracking-[0.09em] text-paper/25">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-[24px] font-semibold leading-none tracking-tight text-paper">
        {value}
      </p>
      <p className={`mt-1.5 font-mono text-[9px] ${deltaColor}`}>{delta}</p>
    </div>
  );
}
