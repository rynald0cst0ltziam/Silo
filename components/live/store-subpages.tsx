"use client";

import { useMemo, useState } from "react";
import type { StoreLive } from "@/lib/store-live";
import { StoreLiveProvider, useStoreLive } from "@/components/live/store-live-provider";
import { Tween } from "@/components/live/tween";
import { WarmupLive } from "@/components/live/warmup-live";
import { EventFeed } from "@/components/live/event-feed";
import { ScanPanel, type ScanState } from "@/components/live/scan-panel";
import { useToast } from "@/components/live/toast";
import { ago, ms, pathOf } from "@/components/live/format";
import { EventUsageMeter } from "@/components/event-usage-meter";
import { RescanButton } from "@/components/store-action-buttons";
import { cn } from "@/lib/utils";

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3.5 py-3">
      <p className="font-mono text-[11.5px] uppercase tracking-wider text-paper/30">{label}</p>
      <p className="mt-1.5 font-display text-[26px] tracking-[-0.04em] text-paper">
        <Tween value={value} />
      </p>
      {hint && <p className="mt-1 font-mono text-[12px] text-paper/30">{hint}</p>}
    </div>
  );
}

/* Warmup ---------------------------------------------------------------- */

export function WarmupPageLive({ storeId, initial }: { storeId: string; initial: StoreLive }) {
  return (
    <StoreLiveProvider storeId={storeId} initial={initial}>
      <WarmupPage />
    </StoreLiveProvider>
  );
}

function WarmupPage() {
  const { data } = useStoreLive();
  const w = data.stats?.warmup ?? {};
  const jobs = [...data.warmup.active, ...data.warmup.recent];
  const results = jobs.flatMap((j) => j.results.map((r) => ({ ...r, job: j })));

  return (
    <div>
      <h2 className="text-[24px] font-medium tracking-[-0.03em] text-paper">Warmup</h2>
      <p className="mt-0.5 font-mono text-[13px] text-paper/30">Silo plans the order; the connector fetches each URL from the store for desktop and mobile</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Queued" value={w.queued ?? 0} hint="on the store" />
        <Stat label="Warming" value={w.warming ?? 0} hint="in flight" />
        <Stat label="Warmed (24h)" value={w.warm_24h ?? data.kpis.warmed24h} hint="pages rebuilt" />
        <Stat label="Failed (24h)" value={w.failed_24h ?? 0} hint="after one retry" />
        <Stat label="Avg per URL" value={w.avg_ms ?? 0} hint="ms · desktop" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <WarmupLive active={data.warmup.active} recent={data.warmup.recent} limit={14} />
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
          <p className="text-[15px] font-medium text-paper/65">How warmup is scheduled</p>
          <div className="mt-3 space-y-0">
            {[
              ["After every invalidation", `priority URLs · up to ${data.tier.warmupUrlsPerEvent} per event (${data.tier.name})`],
              ["After the catalog scan", "shop, bestsellers, top categories"],
              ["Stale entries", "refreshed in the background, never in a shopper request"],
              ["Daily priority pass", "04:00 UTC"],
              ["Fallback", "jobs the connector cannot run in 10 min are warmed by Silo"],
            ].map(([k, v], i) => (
              <div key={k} className={cn("flex justify-between gap-4 py-2 text-[14px]", i > 0 && "border-t border-white/5")}>
                <span className="text-paper/45">{k}</span>
                <span className="text-right text-paper/75">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="border-b border-white/8 px-4 py-3">
          <p className="text-[15px] font-medium text-paper/65">URL results</p>
        </div>
        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-paper/30">No warmup results yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-white/7 font-mono text-[12px] uppercase tracking-[0.08em] text-paper/25">
                  <th className="px-4 py-2 font-normal">URL</th>
                  <th className="px-4 py-2 font-normal">Result</th>
                  <th className="px-4 py-2 font-normal">HTTP</th>
                  <th className="px-4 py-2 font-normal">Time</th>
                  <th className="px-4 py-2 font-normal">Note</th>
                  <th className="px-4 py-2 font-normal">Run</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 60).map((r, i) => (
                  <tr key={`${r.job.id}-${r.url}-${i}`} className="border-b border-white/5">
                    <td className="max-w-[360px] truncate px-4 py-2 font-code text-[13px] text-paper/60" title={r.url}>{pathOf(r.url)}</td>
                    <td className="px-4 py-2">
                      <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[12px]", r.status === "warm" ? "border-mint/25 bg-mint/10 text-mint" : r.status === "failed" ? "border-rose/25 bg-rose/10 text-rose" : "border-white/10 text-paper/40")}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[13px] text-paper/40">{r.code || "—"}</td>
                    <td className="px-4 py-2 font-mono text-[13px] text-paper/40">{r.ms ? ms(r.ms) : "—"}</td>
                    <td className="max-w-[220px] truncate px-4 py-2 font-mono text-[13px] text-paper/35">{r.error || r.cache || ""}</td>
                    <td className="px-4 py-2 font-mono text-[13px] text-paper/30">{ago(r.job.completedAt ?? r.job.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* Invalidations --------------------------------------------------------- */

const GROUPS: Array<[string, string, (t: string) => boolean]> = [
  ["all", "All", () => true],
  ["stock", "Stock & orders", (t) => t.startsWith("stock.") || t.startsWith("order.")],
  ["price", "Price & sales", (t) => t.startsWith("price.") || t.startsWith("sale.")],
  ["product", "Products", (t) => t.startsWith("product.") || t.startsWith("review.")],
  ["terms", "Categories & attributes", (t) => t.startsWith("term.")],
  ["system", "System", (t) => t.startsWith("system.") || t.includes("purge")],
];

export function InvalidationsPageLive({ storeId, initial }: { storeId: string; initial: StoreLive }) {
  return (
    <StoreLiveProvider storeId={storeId} initial={initial} events={100}>
      <InvalidationsPage />
    </StoreLiveProvider>
  );
}

function InvalidationsPage() {
  const { data } = useStoreLive();
  const [group, setGroup] = useState("all");
  const filter = GROUPS.find((g) => g[0] === group)![2];
  const events = useMemo(() => data.events.filter((e) => filter(e.type)), [data.events, filter]);
  const warmed24 = data.kpis.warmed24h;

  return (
    <div>
      <h2 className="text-[24px] font-medium tracking-[-0.03em] text-paper">Invalidations</h2>
      <p className="mt-0.5 font-mono text-[13px] text-paper/30">Every catalog change, what was purged and what was re-warmed — live</p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Events (24h)" value={data.kpis.invalidations24h} hint="counted against plan" />
        <Stat label="URLs purged (24h)" value={data.kpis.purged24h} />
        <Stat label="URLs re-warmed (24h)" value={warmed24} />
        <Stat label="Avg graph walk" value={data.kpis.avgDurationMs} hint="ms" />
      </div>

      <div className="mt-3 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <EventUsageMeter used={data.store.monthlyEvents} max={data.tier.maxMonthlyEvents} />
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/8 px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setGroup(key)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[13.5px] font-medium transition",
                  group === key ? "border-accent/35 bg-accent/10 text-accent-hi" : "border-white/8 text-paper/45 hover:text-paper/80",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-paper/30">
            <span className="pulse-dot h-1 w-1" /> {events.length} shown
          </span>
        </div>
        <EventFeed events={events} jobs={[...data.warmup.active, ...data.warmup.recent]} showTime />
      </div>
    </div>
  );
}

/* Catalog --------------------------------------------------------------- */

type Profile = {
  product_count?: number;
  variation_count?: number;
  archive_count?: number;
  product_types?: Record<string, number>;
  stock?: Record<string, number>;
  variation_stock?: Record<string, number>;
  taxonomies?: Record<string, { label: string; terms: number; archives: number; public: boolean }>;
  store_api_routes?: string[];
  private_route_count?: number;
  hpos?: boolean;
  multilingual?: string[];
  currencies?: string[];
  conflicts?: string[];
  graph?: { nodes: number; edges: number };
  priority_urls?: string[];
  environment?: Record<string, unknown>;
};

type Config = {
  version?: number;
  tier?: string;
  ttl?: Record<string, number>;
  limits?: { warmup_urls_per_event?: number };
  variants?: { currency?: boolean; language?: string[]; language_cookie?: boolean };
};

export function CatalogPageLive({ storeId, initial, profile, config }: { storeId: string; initial: StoreLive; profile: Profile | null; config: Config | null }) {
  return (
    <StoreLiveProvider storeId={storeId} initial={initial}>
      <CatalogPage profile={profile} config={config} />
    </StoreLiveProvider>
  );
}

function CatalogPage({ profile, config }: { profile: Profile | null; config: Config | null }) {
  const { data } = useStoreLive();
  const { notify, node } = useToast();
  const scan = data.scan as ScanState | null;
  const scanning = scan?.status === "running";
  // While a scan runs (or just finished) the live counts are newer than the stored profile.
  const counts = scan?.counts;
  const types = (scanning || !profile ? scan?.types : profile.product_types) ?? {};
  const maxType = Math.max(1, ...Object.values(types));
  const ttl = config?.ttl ?? {};
  const fmtTtl = (v?: number) => (!v ? "—" : v >= 3600 ? `${(v / 3600).toFixed(v % 3600 ? 1 : 0)}h` : `${Math.round(v / 60)}m`);
  const env = profile?.environment ?? {};

  return (
    <div>
      {node}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[24px] font-medium tracking-[-0.03em] text-paper">Catalog</h2>
          <p className="mt-0.5 font-mono text-[13px] text-paper/30">
            Last scan {data.store.lastScanAt ? new Date(data.store.lastScanAt).toLocaleString() : "never"}
            {env.wc ? ` · WooCommerce ${String(env.wc)}` : ""}
          </p>
        </div>
        <RescanButton storeId={data.store.id} onDone={notify} disabled={scanning} />
      </div>

      {scan && (scanning || scan.status === "failed") && (
        <div className="mt-4">
          <ScanPanel scan={scan} />
        </div>
      )}

      {!profile && !scanning ? (
        <p className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5 text-[14px] text-paper/40">
          No scan yet. Connect the plugin in WooCommerce → Silo — the scan starts automatically.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Products" value={counts?.products ?? profile?.product_count ?? 0} hint="published" />
            <Stat label="Variations" value={counts?.variations ?? profile?.variation_count ?? 0} hint="own cache nodes" />
            <Stat label="Archives" value={counts?.archives ?? profile?.archive_count ?? 0} hint="resolved" />
            <Stat label="Store API routes" value={counts?.routes ?? profile?.store_api_routes?.length ?? 0} hint={`${profile?.private_route_count ?? 0} kept private`} />
            <Stat label="Graph nodes" value={counts?.nodes ?? profile?.graph?.nodes ?? 0} hint={`${(counts?.edges ?? profile?.graph?.edges ?? 0).toLocaleString()} edges`} />
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
              <p className="text-[15px] font-medium text-paper/65">Product types</p>
              <div className="mt-3 space-y-1.5">
                {Object.entries(types)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, n]) => (
                    <div key={type} className="grid grid-cols-[130px_1fr_60px] items-center gap-3 text-[14px]">
                      <span className="capitalize text-paper/60">{type.replace(/-/g, " ")}</span>
                      <div className="h-1 overflow-hidden rounded-full bg-white/6">
                        <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${(n / maxType) * 100}%` }} />
                      </div>
                      <span className="text-right text-paper/80">{n.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
              <p className="text-[15px] font-medium text-paper/65">Stock</p>
              <div className="mt-3">
                {[
                  ["Products managing stock", profile?.stock?.managed],
                  ["Products in / out of stock", profile ? `${(profile.stock?.instock ?? 0).toLocaleString()} / ${(profile.stock?.outofstock ?? 0).toLocaleString()}` : "—"],
                  ["Products on backorder", profile?.stock?.onbackorder],
                  ["Variations in / out of stock", profile ? `${(profile.variation_stock?.instock ?? 0).toLocaleString()} / ${(profile.variation_stock?.outofstock ?? 0).toLocaleString()}` : "—"],
                  ["Variations on backorder", profile?.variation_stock?.onbackorder],
                ].map(([k, v], i) => (
                  <div key={k as string} className={cn("flex justify-between py-2 text-[14px]", i > 0 && "border-t border-white/5")}>
                    <span className="text-paper/45">{k}</span>
                    <span className="text-paper/80">{typeof v === "number" ? v.toLocaleString() : (v ?? "—")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {profile?.taxonomies && (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
              <div className="border-b border-white/8 px-4 py-3">
                <p className="text-[15px] font-medium text-paper/65">Taxonomies &amp; archives</p>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/7 font-mono text-[12px] uppercase tracking-[0.08em] text-paper/25">
                    <th className="px-4 py-2 font-normal">Taxonomy</th>
                    <th className="px-4 py-2 font-normal">Terms</th>
                    <th className="px-4 py-2 font-normal">Archives</th>
                    <th className="px-4 py-2 text-right font-normal">Visibility</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(profile.taxonomies).map(([key, t]) => (
                    <tr key={key} className="border-b border-white/5">
                      <td className="px-4 py-2 text-[14px] text-paper/75">
                        {t.label} <span className="ml-1 font-code text-[12.5px] text-paper/30">{key}</span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[13.5px] text-paper/45">{t.terms.toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono text-[13.5px] text-paper/45">{t.archives.toLocaleString()}</td>
                      <td className="px-4 py-2 text-right">
                        <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[12px]", t.public ? "border-mint/25 bg-mint/10 text-mint/85" : "border-white/10 text-paper/35")}>
                          {t.public ? "public" : "not public"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
              <p className="text-[15px] font-medium text-paper/65">Detected capabilities</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Chip on={!!profile?.hpos}>{profile?.hpos ? "HPOS" : "Legacy order storage"}</Chip>
                {(profile?.multilingual?.length ?? 0) > 1 && <Chip on>Languages: {profile!.multilingual!.join(", ")}</Chip>}
                {(profile?.currencies?.length ?? 0) > 1 && <Chip on>Currencies: {profile!.currencies!.join(", ")}</Chip>}
                {(profile?.conflicts ?? []).map((c) => (
                  <Chip key={c} warn>{c} page cache active</Chip>
                ))}
                {env.block_checkout ? <Chip on>Block checkout</Chip> : null}
                {env.hide_oos ? <Chip on>Hides out-of-stock</Chip> : null}
              </div>
            </div>
            <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-medium text-paper/65">Active cache profile</p>
                <span className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[12px] text-paper/40">v{config?.version ?? 0}</span>
              </div>
              <div className="mt-3">
                {[
                  ["Plan", config?.tier ?? "—"],
                  ["TTL product · category · shop", `${fmtTtl(ttl.product)} · ${fmtTtl(ttl.category)} · ${fmtTtl(ttl.shop)}`],
                  ["Store API TTL", fmtTtl(ttl.store_api)],
                  ["Warmup URLs per event", String(config?.limits?.warmup_urls_per_event ?? "—")],
                  ["Priority URLs", String(profile?.priority_urls?.length ?? 0)],
                ].map(([k, v], i) => (
                  <div key={k} className={cn("flex justify-between py-2 text-[14px]", i > 0 && "border-t border-white/5")}>
                    <span className="text-paper/45">{k}</span>
                    <span className="capitalize text-paper/80">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ children, on, warn }: { children: React.ReactNode; on?: boolean; warn?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[13px] font-medium",
        warn ? "border-amber/25 bg-amber/[0.06] text-amber/90" : on ? "border-mint/20 bg-mint/[0.05] text-mint/80" : "border-white/10 bg-white/[0.02] text-paper/45",
      )}
    >
      {children}
    </span>
  );
}
