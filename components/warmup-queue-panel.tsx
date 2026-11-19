"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface WarmupJob {
  id: string;
  status: string;
  progress: number;
  total: number;
  urls: string[];
  createdAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    pending: "border-amber/20 bg-amber/8 text-amber/70",
    running: "border-accent/20 bg-accent/8 text-accent/80",
    completed: "border-mint/20 bg-mint/8 text-mint/70",
    failed: "border-red-500/20 bg-red-500/8 text-red-400/80",
    partial: "border-amber/20 bg-amber/8 text-amber/70",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] ${styles[status] ?? styles.pending}`}
    >
      {status === "running" && (
        <Loader2 className="h-2 w-2 animate-spin" />
      )}
      {status}
    </span>
  );
}

export function WarmupQueuePanel({ jobs }: { jobs: WarmupJob[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const activeJobs = jobs.filter(
    (j) => j.status === "pending" || j.status === "running",
  );
  const activeUrlCount = activeJobs.reduce((s, j) => s + j.total, 0);

  const urlEntries: Array<{ url: string; pct: number; jobStatus: string }> =
    [];
  for (const job of activeJobs) {
    const jobPct = job.total > 0 ? (job.progress / job.total) * 100 : 0;
    for (const url of job.urls) {
      urlEntries.push({
        url,
        pct: Math.round(jobPct),
        jobStatus: job.status,
      });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-paper/65">Warmup queue</p>
        <span className="font-mono text-[12px] text-amber/70">
          {activeUrlCount > 0 ? `${activeUrlCount} active` : "idle"}
        </span>
      </div>

      {urlEntries.length > 0 && (
        <>
          <div className="mt-3 space-y-2.5">
            {urlEntries.slice(0, 5).map((entry, i) => {
              let path: string;
              try {
                path = new URL(entry.url).pathname;
              } catch {
                path = entry.url;
              }
              return (
                <div key={`${entry.url}-${i}`}>
                  <div className="flex items-center justify-between gap-2 font-mono text-[12px]">
                    <span className="truncate text-paper/35">{path}</span>
                    <span className="text-paper/25">{entry.pct}%</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/6">
                    <div
                      className="h-full rounded-full bg-accent/80 transition-all"
                      style={{ width: `${entry.pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {urlEntries.length > 5 && (
            <p className="mt-2 font-mono text-[9px] text-paper/20">
              +{urlEntries.length - 5} more in queue
            </p>
          )}
        </>
      )}

      {/* Job history */}
      <div className="mt-3 border-t border-white/8 pt-2">
        <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-paper/20">
          Jobs ({jobs.length})
        </p>
        <div className="space-y-1">
          {jobs.slice(0, 8).map((job) => {
            const pct =
              job.total > 0
                ? Math.round((job.progress / job.total) * 100)
                : 0;
            const expanded = expandedId === job.id;
            return (
              <div key={job.id}>
                <div
                  className="flex cursor-pointer items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                  onClick={() =>
                    setExpandedId(expanded ? null : job.id)
                  }
                >
                  <span
                    className="text-[12px] text-paper/20 transition-transform"
                    style={{
                      transform: expanded
                        ? "rotate(90deg)"
                        : "rotate(0deg)",
                    }}
                  >
                    ▶
                  </span>
                  {statusBadge(job.status)}
                  <span className="font-mono text-[12px] text-paper/40">
                    {job.progress}/{job.total}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-0.5 w-10 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-accent/70"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-paper/20">
                      {timeAgo(job.createdAt)}
                    </span>
                  </div>
                </div>
                {expanded && job.urls.length > 0 && (
                  <div className="ml-4 mt-1 max-h-24 overflow-y-auto rounded border border-white/5 bg-black/20 p-2">
                    {job.urls.map((url, i) => (
                      <p
                        key={i}
                        className="truncate font-mono text-[12px] text-paper/35"
                      >
                        {url}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {jobs.length === 0 && (
        <p className="mt-4 text-[12px] text-paper/30">
          No warmup jobs. URLs warm automatically after invalidation.
        </p>
      )}
    </div>
  );
}
