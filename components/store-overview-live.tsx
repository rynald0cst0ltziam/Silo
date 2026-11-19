"use client";

import { ArrowDownRight, ExternalLink, ShieldCheck } from "lucide-react";
import type { StoreLive } from "@/lib/store-live";
import { StoreLiveProvider, useStoreLive } from "@/components/live/store-live-provider";
import { Tween } from "@/components/live/tween";
import { ScanPanel, type ScanState } from "@/components/live/scan-panel";
import { TrafficTicker } from "@/components/live/traffic-ticker";
import { WarmupLive } from "@/components/live/warmup-live";
import { EventFeed } from "@/components/live/event-feed";
import { LatestEventCard } from "@/components/live/latest-event-card";
import { useToast } from "@/components/live/toast";
import { ago, bytes, ms } from "@/components/live/format";
import { HitRateChart } from "@/components/hit-rate-chart";
import { EventUsageMeter } from "@/components/event-usage-meter";
import { CachedUrlsPanel } from "@/components/cached-urls-panel";
import { RescanButton, PurgeAllButton } from "@/components/store-action-buttons";
import { cn } from "@/lib/utils";

export function StoreOverviewLive({ storeId, initialData }: { storeId: string; initialData: StoreLive }) {
  return (
    <StoreLiveProvider storeId={storeId} initial={initialData}>
      <Overview />
    </StoreLiveProvider>
  );
}

function Overview() {
  const { data, updatedAt, error } = useStoreLive();
  const { notify, node } = useToast();
  const { store, stats, scan, today, kpis, tier } = data;
  const scanState = scan as ScanState | null;
  const scanning = scanState?.status === "running";
  const recentScan = scanState?.status === "complete" && scanState.finished_at && Date.now() / 1000 - scanState.finished_at < 180;
  const connected = store.status !== "pending" || !!store.lastSeenAt;

  const warm = stats?.warmup ?? {};
  const pending = (warm.queued ?? 0) + (warm.warming ?? 0) + data.warmup.active.reduce((s, j) => s + Math.max(0, j.total - j.progress - j.failed), 0);
  const faster = stats?.avg_hit_ms && stats?.avg_miss_ms ? Math.max(0, Math.round((1 - stats.avg_hit_ms / stats.avg_miss_ms) * 100)) : 0;

  return (
    <div>
      {node}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-medium tracking-[-0.03em] text-paper">Overview</h2>
          <p className="mt-0.5 font-mono text-[13px] text-paper/30" suppressHydrationWarning>
            {store.url.replace(/^https?:\/\//, "")} · live{updatedAt ? ` · updated ${new Date(updatedAt).toLocaleTimeString()}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RescanButton storeId={store.id} onDone={notify} disabled={scanning} />
          <PurgeAllButton storeId={store.id} onDone={notify} />
          <a
            href={store.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[14px] font-medium text-paper/60 transition hover:bg-white/[0.06] hover:text-paper/80"
          >
            Storefront <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <HealthStrip />
      {error && <p className="mt-3 rounded-lg border border-rose/25 bg-rose/[0.06] px-3 py-2 text-[14px] text-rose">{error}</p>}

      {!connected && <ConnectHint storeId={store.id} />}

      {(scanning || recentScan || scanState?.status === "failed") && (
        <div className="mt-4">
          <ScanPanel scan={scanState!} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Kpi
          label="Hit rate"
          value={<><Tween value={stats ? Number(stats.hit_rate ?? store.hitRate * 100) : store.hitRate * 100} decimals={1} /><small>%</small></>}
          delta={stats ? `${(stats.hits ?? 0).toLocaleString()} hits · ${(stats.misses ?? 0).toLocaleString()} misses` : "waiting for first heartbeat"}
          tone={stats?.hits ? "mint" : undefined}
        />
        <Kpi
          label="Avg response"
          value={stats?.avg_hit_ms ? <><Tween value={stats.avg_hit_ms} /><small>ms</small></> : "—"}
          delta={stats?.avg_miss_ms ? `origin ${ms(stats.avg_miss_ms)}${faster ? ` · ${faster}% faster` : ""}` : "measured on cache hits"}
          tone={faster ? "mint" : undefined}
          icon={faster > 0}
        />
        <Kpi label="Invalidations" value={<Tween value={kpis.invalidations24h} />} delta={`last 24h · ${kpis.purged24h.toLocaleString()} URLs${kpis.avgDurationMs ? ` · ${ms(kpis.avgDurationMs)} avg` : ""}`} />
        <Kpi label="Warmup queue" value={<Tween value={pending} />} delta={`${warm.warming ?? 0} warming · ${kpis.warmed24h.toLocaleString()} warmed 24h`} tone={pending ? "amber" : undefined} />
      </div>

      <div className="mt-3">
        <LatestEventCard event={data.events.find((e) => e.counted) ?? data.events[0]} graphNodes={data.catalog?.nodes ?? 0} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <TrafficTicker />
        <WarmupLive active={data.warmup.active} recent={data.warmup.recent} limit={6} />
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="text-[15px] font-medium text-paper/65">Recent invalidations</p>
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-paper/30">
            <span className="pulse-dot h-1 w-1" /> live log
          </span>
        </div>
        <EventFeed events={data.events.slice(0, 10)} jobs={[...data.warmup.active, ...data.warmup.recent]} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-paper/65">Session boundary</p>
            <span className="inline-flex items-center gap-1 rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[12px] text-mint/80">
              <ShieldCheck className="h-3 w-3" /> 0 shared
            </span>
          </div>
          <p className="mt-3 font-display text-[30px] leading-none tracking-[-0.04em] text-paper">
            <Tween value={stats?.bypass ?? 0} />
            <span className="ml-1.5 text-[14px] text-paper/40">bypassed</span>
          </p>
          <p className="mt-2 font-mono text-[12.5px] text-paper/30">cart · checkout · account · logged-in · {today.bypasses.toLocaleString()} today</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-paper/65">Cache inventory</p>
            <span className="font-mono text-[12px] text-paper/30">{bytes(stats?.cache_bytes)}</span>
          </div>
          <Rows
            rows={[
              ["Cached pages", <Tween key="p" value={stats?.cached_pages ?? 0} />],
              ["Store API filter sets", <Tween key="a" value={stats?.api_entries ?? 0} />],
              ["Store API hit rate", `${Number(stats?.api_hit_rate ?? 0).toFixed(1)}%`],
            ]}
          />
        </div>
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-paper/65">Catalog graph</p>
            <span className="font-mono text-[12px] text-paper/30">profile v{store.configVersion}</span>
          </div>
          <Rows
            rows={[
              ["Products · variations", data.catalog ? `${data.catalog.products.toLocaleString()} · ${data.catalog.variations.toLocaleString()}` : "—"],
              ["Archives · API routes", data.catalog ? `${data.catalog.archives.toLocaleString()} · ${data.catalog.routes}` : "—"],
              ["Last scan", ago(store.lastScanAt)],
            ]}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.55fr_1fr]">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium text-paper/65">Hit rate · 30 days</p>
            <span className="font-mono text-[12px] text-paper/30">
              today {today.hits + today.misses > 0 ? ((today.hits / (today.hits + today.misses)) * 100).toFixed(1) : "0.0"}% · {(today.hits + today.misses).toLocaleString()} requests
            </span>
          </div>
          <div className="mt-2">
            <HitRateChart data={data.chart} />
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
            <EventUsageMeter used={store.monthlyEvents} max={tier.maxMonthlyEvents} />
          </div>
          <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
            <CachedUrlsPanel storeId={store.id} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthStrip() {
  const { data } = useStoreLive();
  const env = (data.env ?? {}) as { mode?: string; conflicts?: string[]; auth_error?: string; page_cache?: boolean; store_api?: boolean; dropin?: string };
  const pills: Array<{ label: string; tone: "mint" | "amber" | "rose" | "dim"; pulse?: boolean }> = [];

  if (!data.store.lastSeenAt) pills.push({ label: "Connector not installed yet", tone: "rose" });
  else if (data.online) pills.push({ label: `Connector online · ${ago(data.store.lastSeenAt)}`, tone: "mint", pulse: true });
  else pills.push({ label: `Connector last seen ${ago(data.store.lastSeenAt)}`, tone: "amber" });

  if (env.auth_error) pills.push({ label: env.auth_error, tone: "rose" });
  if (env.page_cache === false) pills.push({ label: "Page cache disabled in WordPress", tone: "rose" });
  else if (env.mode === "dropin") pills.push({ label: "Serving before WordPress loads", tone: "mint" });
  else if (env.mode === "late") pills.push({ label: "Late serve mode (drop-in owned elsewhere)", tone: "amber" });
  if (env.store_api) pills.push({ label: "Store API cache on", tone: "dim" });
  (env.conflicts ?? []).forEach((c) => pills.push({ label: `${c} page cache active`, tone: "amber" }));
  if (data.stats?.events_queued) pills.push({ label: `${data.stats.events_queued} events sending`, tone: "dim", pulse: true });
  if (data.store.connectorVersion) pills.push({ label: `connector v${data.store.connectorVersion}`, tone: "dim" });

  const tones = {
    mint: "border-mint/20 bg-mint/[0.05] text-mint/85",
    amber: "border-amber/25 bg-amber/[0.06] text-amber/90",
    rose: "border-rose/25 bg-rose/[0.06] text-rose/90",
    dim: "border-white/10 bg-white/[0.02] text-paper/50",
  };

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {pills.map((p) => (
        <span key={p.label} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] font-medium", tones[p.tone])}>
          {p.pulse ? <span className="pulse-dot h-1 w-1" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
          {p.label}
        </span>
      ))}
    </div>
  );
}

function ConnectHint({ storeId }: { storeId: string }) {
  return (
    <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[0.05] p-4">
      <p className="text-[15px] font-medium text-paper/85">Waiting for the connector</p>
      <p className="mt-1 text-[14px] text-paper/50">
        Install the connector, open <span className="text-paper/75">WooCommerce → Silo</span> and paste this store&apos;s key. The scan appears here live as it maps the catalog.
      </p>
      <a
        href="/api/connector/download"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[14px] font-medium text-white hover:bg-accent-hi"
        data-store={storeId}
      >
        Download connector
      </a>
    </div>
  );
}

function Kpi({ label, value, delta, tone, icon }: { label: string; value: React.ReactNode; delta: string; tone?: "mint" | "amber"; icon?: boolean }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3.5 py-3.5">
      <p className="font-mono text-[11.5px] uppercase tracking-[0.1em] text-paper/30">{label}</p>
      <p className="mt-2 font-display text-[32px] font-medium leading-none tracking-[-0.045em] text-paper [&_small]:ml-0.5 [&_small]:text-[15px] [&_small]:tracking-normal [&_small]:text-paper/40">
        {value}
      </p>
      <p className={cn("mt-2 flex items-center gap-1 truncate font-mono text-[12.5px]", tone === "mint" ? "text-mint/70" : tone === "amber" ? "text-amber/75" : "text-paper/30")}>
        {icon && <ArrowDownRight className="h-3 w-3" />}
        {delta}
      </p>
    </div>
  );
}

function Rows({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="mt-3">
      {rows.map(([k, v], i) => (
        <div key={k} className={cn("flex items-center justify-between gap-3 py-2 text-[14px]", i > 0 && "border-t border-white/5")}>
          <span className="text-paper/45">{k}</span>
          <span className="truncate text-right text-paper/80">{v}</span>
        </div>
      ))}
    </div>
  );
}
