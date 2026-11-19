"use client";

import { Loader2 } from "lucide-react";
import type { LiveWarmJob } from "@/lib/store-live";
import { ago, ms, pathOf } from "@/components/live/format";
import { cn } from "@/lib/utils";

const SOURCE: Record<string, string> = {
  event: "after invalidation",
  scan: "initial warmup",
  manual: "manual",
  purge: "after purge",
  daily: "daily priority pass",
};

function sourceLabel(source: string) {
  const base = source.replace("+fallback", "");
  return (SOURCE[base] ?? base) + (source.includes("+fallback") ? " · warmed by Silo" : "");
}

/**
 * URL-level warmup progress, reported by the connector after every parallel batch.
 */
export function WarmupLive({ active, recent, limit = 8 }: { active: LiveWarmJob[]; recent: LiveWarmJob[]; limit?: number }) {
  const rows: Array<{ url: string; state: string; ms?: number; note?: string }> = [];
  for (const job of active) {
    const done = new Map(job.results.map((r) => [r.url, r]));
    for (const url of job.urls) {
      const r = done.get(url);
      rows.push(r ? { url, state: r.status, ms: r.ms, note: r.error } : { url, state: job.status === "running" ? "warming" : "queued" });
    }
  }
  rows.sort((a, b) => order(a.state) - order(b.state));
  const queued = active.reduce((s, j) => s + Math.max(0, j.total - j.progress - j.failed), 0);

  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-medium text-paper/65">Warmup queue</p>
        <span className={cn("font-mono text-[13px]", queued ? "text-amber/80" : "text-paper/30")}>{queued ? `${queued} remaining` : "idle"}</span>
      </div>

      {rows.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {rows.slice(0, limit).map((r, i) => (
            <div key={`${r.url}-${i}`}>
              <div className="flex items-center justify-between gap-2 font-mono text-[13px]">
                <span className="truncate text-paper/50" title={r.url}>{pathOf(r.url)}</span>
                <span className={cn("shrink-0", r.state === "warm" ? "text-mint/70" : r.state === "failed" ? "text-rose/80" : "text-paper/30")}>
                  {r.state === "warm" ? ms(r.ms) : r.state === "failed" ? r.note || "failed" : r.state}
                </span>
              </div>
              <div className="relative mt-1 h-1 overflow-hidden rounded-full bg-white/6">
                {r.state === "warming" ? (
                  <div className="absolute inset-y-0 w-2/5 animate-[sweep_1.2s_ease-in-out_infinite] rounded-full bg-accent/80" />
                ) : (
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", r.state === "warm" ? "w-full bg-mint/70" : r.state === "failed" ? "w-full bg-rose/60" : r.state === "skipped" ? "w-full bg-white/20" : "w-0")}
                  />
                )}
              </div>
            </div>
          ))}
          {rows.length > limit && <p className="font-mono text-[12px] text-paper/25">+{rows.length - limit} more in this run</p>}
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-paper/30">Queue is empty. Silo re-warms priority pages right after every invalidation.</p>
      )}

      {recent.length > 0 && (
        <div className="mt-4 border-t border-white/8 pt-3">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-paper/25">Recent runs</p>
          <div className="space-y-1">
            {recent.slice(0, 5).map((job) => {
              const avg = job.results.length ? job.results.reduce((s, r) => s + (r.ms ?? 0), 0) / job.results.length : 0;
              return (
                <div key={job.id} className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1.5 font-mono text-[13px]">
                  {job.status === "running" ? <Loader2 className="h-3 w-3 animate-spin text-accent" /> : (
                    <span className={cn("h-1.5 w-1.5 rounded-full", job.status === "completed" ? "bg-mint" : job.status === "failed" ? "bg-rose" : "bg-amber")} />
                  )}
                  <span className="text-paper/55">{job.progress}/{job.total}</span>
                  <span className="truncate text-paper/30">{sourceLabel(job.source)}</span>
                  <span className="ml-auto shrink-0 text-paper/25">{avg ? `${ms(avg)} avg · ` : ""}{ago(job.completedAt ?? job.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function order(state: string) {
  return { warming: 0, queued: 1, warm: 2, skipped: 3, failed: 4 }[state] ?? 5;
}
