"use client";

import { useState, useEffect } from "react";

interface CachedUrl {
  url: string;
  device: string;
  currency: string;
  language: string;
  age: number;
  ttl: number;
  fresh: boolean;
  size: number;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function CachedUrlsPanel({ storeId }: { storeId: string }) {
  const [urls, setUrls] = useState<CachedUrl[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchCachedUrls = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/stores/${storeId}/cache`);
      const data = await resp.json();
      if (data.error && (!data.cached_urls || data.cached_urls.length === 0)) {
        setError(data.error);
      }
      setUrls(data.cached_urls ?? []);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const freshCount = urls.filter((u) => u.fresh).length;
  const staleCount = urls.filter((u) => !u.fresh).length;
  const totalSize = urls.reduce((s, u) => s + u.size, 0);

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-paper/65">
          Cached pages
        </p>
        {loaded && (
          <span className="font-mono text-[8px] text-paper/30">
            {urls.length} pages · {formatSize(totalSize)}
          </span>
        )}
      </div>

      {!loaded ? (
        <div className="mt-3">
          <button
            onClick={fetchCachedUrls}
            disabled={loading}
            className="rounded border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[9px] text-paper/50 transition-colors hover:bg-white/[0.06]"
          >
            {loading ? "Loading..." : "Load cached URLs"}
          </button>
          <p className="mt-2 font-mono text-[8px] text-paper/20">
            Fetches live data from your store&apos;s cache directory
          </p>
        </div>
      ) : error && urls.length === 0 ? (
        <div className="mt-3">
          <p className="font-mono text-[9px] text-red-400/70">{error}</p>
          <p className="mt-1 font-mono text-[8px] text-paper/20">
            Store may be offline or not reachable
          </p>
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="mt-2 flex gap-3 font-mono text-[8px]">
            <span className="text-mint/60">{freshCount} fresh</span>
            {staleCount > 0 && (
              <span className="text-amber/60">{staleCount} stale</span>
            )}
          </div>

          {/* URL list */}
          <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {urls.map((entry, i) => {
              let path: string;
              try {
                path = new URL(entry.url).pathname;
              } catch {
                path = entry.url;
              }
              const freshPct = entry.ttl > 0 ? Math.max(0, 100 - (entry.age / entry.ttl) * 100) : 0;

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1"
                >
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${entry.fresh ? "bg-mint" : "bg-amber"}`}
                  />
                  <span className="min-w-0 flex-1 truncate font-mono text-[8px] text-paper/40">
                    {path}
                  </span>
                  <span className="flex-shrink-0 font-mono text-[7px] text-paper/20">
                    {entry.device === "mobile" ? "M" : "D"}
                  </span>
                  <span className="flex-shrink-0 font-mono text-[7px] text-paper/20">
                    {formatAge(entry.age)}
                  </span>
                  <div className="h-0.5 w-8 flex-shrink-0 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full rounded-full ${entry.fresh ? "bg-mint/60" : "bg-amber/60"}`}
                      style={{ width: `${freshPct}%` }}
                    />
                  </div>
                  <span className="flex-shrink-0 font-mono text-[7px] text-paper/15">
                    {formatSize(entry.size)}
                  </span>
                </div>
              );
            })}
          </div>

          <button
            onClick={fetchCachedUrls}
            disabled={loading}
            className="mt-2 font-mono text-[8px] text-accent/60 hover:text-accent/80"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </>
      )}
    </div>
  );
}
