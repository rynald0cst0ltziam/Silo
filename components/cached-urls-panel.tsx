"use client";

import { useMemo, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { bytes, ms } from "@/components/live/format";
import { cn } from "@/lib/utils";

type Entry = {
  url: string;
  type?: string;
  scope?: string;
  device: string;
  currency?: string;
  language?: string;
  age: number;
  ttl: number;
  fresh: boolean;
  size: number;
  render_ms?: number;
};

type Group = { url: string; label: string; type: string; variants: Entry[]; size: number; freshest: number; stale: number };

function age(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function label(url: string): string {
  try {
    const u = new URL(url);
    return decodeURI(u.pathname + u.search);
  } catch {
    return url;
  }
}

const TYPE_LABEL: Record<string, string> = { product: "Product", archive: "Archive", shop: "Shop", front: "Front page" };

/**
 * What is cached on the store right now, grouped by URL. Each URL can hold several
 * variants (desktop/mobile, currency, language); query variants such as ?orderby=price
 * are separate URLs.
 */
export function CachedUrlsPanel({ storeId }: { storeId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stores/${storeId}/cache`, { cache: "no-store" });
      const data = await res.json();
      if (data.error && !data.cached_urls?.length) setError(data.error);
      setEntries(data.cached_urls ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
    setLoading(false);
  }

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const e of entries ?? []) {
      const g = map.get(e.url) ?? { url: e.url, label: label(e.url), type: e.type ?? "", variants: [], size: 0, freshest: Infinity, stale: 0 };
      g.variants.push(e);
      g.size += e.size;
      g.freshest = Math.min(g.freshest, e.age);
      if (!e.fresh) g.stale += 1;
      map.set(e.url, g);
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);

  const shown = filter === "all" ? groups : groups.filter((g) => g.type === filter);
  const totalSize = groups.reduce((s, g) => s + g.size, 0);
  const types = [...new Set(groups.map((g) => g.type).filter(Boolean))];

  function exportCsv() {
    const rows = [["url", "type", "scope", "device", "currency", "language", "age_seconds", "ttl_seconds", "fresh", "bytes", "render_ms"]];
    for (const e of entries ?? []) {
      rows.push([e.url, e.type ?? "", e.scope ?? "", e.device, e.currency ?? "", e.language ?? "", String(e.age), String(e.ttl), String(e.fresh), String(e.size), String(e.render_ms ?? "")]);
    }
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "silo-cached-pages.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[15px] font-medium text-paper/65">Cached pages</p>
        {entries && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] text-paper/35">
              {groups.length} URLs · {entries.length} variants · {bytes(totalSize)}
            </span>
            <button type="button" onClick={exportCsv} title="Export CSV" className="text-paper/40 hover:text-paper/80">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={load} title="Refresh" className="text-paper/40 hover:text-paper/80">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>

      {!entries ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[14px] text-paper/60 transition hover:bg-white/[0.06]"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Inspect cache on the store
          </button>
          <p className="mt-2 text-[12.5px] text-paper/30">Reads the live cache directory through the connector.</p>
        </div>
      ) : error && groups.length === 0 ? (
        <p className="mt-3 text-[14px] text-rose/80">{error}</p>
      ) : groups.length === 0 ? (
        <p className="mt-3 text-[13px] text-paper/35">Nothing cached yet. Pages are stored the first time an anonymous shopper or warmup requests them.</p>
      ) : (
        <>
          {types.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["all", ...types].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilter(t)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[12px]",
                    filter === t ? "border-accent/35 bg-accent/10 text-accent-hi" : "border-white/8 text-paper/45 hover:text-paper/80",
                  )}
                >
                  {t === "all" ? "All" : TYPE_LABEL[t] ?? t}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {shown.map((g) => {
              const variants = g.variants.map((v) => [v.device === "mobile" ? "mobile" : "desktop", v.currency, v.language].filter(Boolean).join(" · "));
              const first = g.variants[0];
              const pct = first.ttl > 0 ? Math.max(0, 100 - (g.freshest / first.ttl) * 100) : 0;
              return (
                <div key={g.url} className="rounded border border-white/5 bg-white/[0.02] px-2.5 py-2" title={g.url}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-code text-[12.5px] text-paper/70">{g.label}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-paper/35">{bytes(g.size)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 font-mono text-[11.5px] text-paper/40">
                    {g.type && <span className="rounded bg-white/5 px-1.5 py-0.5 text-paper/55">{TYPE_LABEL[g.type] ?? g.type}</span>}
                    <span className="truncate">{variants.join(", ")}</span>
                    <span className="ml-auto shrink-0">{age(g.freshest)} old</span>
                    <span className="h-1 w-10 shrink-0 overflow-hidden rounded-full bg-white/6">
                      <span className={cn("block h-full rounded-full", g.stale ? "bg-amber/70" : "bg-mint/70")} style={{ width: `${pct}%` }} />
                    </span>
                    {first.render_ms ? <span className="shrink-0">{ms(first.render_ms)} render</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
