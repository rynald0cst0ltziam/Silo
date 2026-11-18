"use client";

import { Loader2 } from "lucide-react";

interface WarmupJob {
  id: string;
  status: string;
  progress: number;
  total: number;
  urls: string[];
  createdAt: string;
}

export function WarmupQueuePanel({ jobs }: { jobs: WarmupJob[] }) {
  const activeJobs = jobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  );
  const activeUrlCount = activeJobs.reduce((s, j) => s + j.total, 0);

  // Collect all URLs from active jobs with their progress
  const urlEntries: Array<{ url: string; pct: number; jobStatus: string }> = [];
  for (const job of activeJobs) {
    const jobPct = job.total > 0 ? (job.progress / job.total) * 100 : 0;
    for (const url of job.urls) {
      urlEntries.push({ url, pct: Math.round(jobPct), jobStatus: job.status });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-paper/65">Warmup queue</p>
        <span className="font-mono text-[8px] text-amber/70">
          {activeUrlCount > 0 ? `${activeUrlCount} active` : "idle"}
        </span>
      </div>

      {urlEntries.length === 0 && jobs.length === 0 ? (
        <p className="mt-4 text-[10px] text-paper/30">
          No warmup jobs. URLs are warmed automatically after invalidation.
        </p>
      ) : urlEntries.length === 0 ? (
        <div className="mt-4">
          <p className="text-[10px] text-paper/30">Queue empty. All URLs warmed.</p>
          {/* Show recent completed */}
          <div className="mt-3 space-y-2">
            {jobs
              .filter((j) => j.status === "completed")
              .slice(0, 3)
              .map((j) => (
                <div
                  key={j.id}
                  className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-2 py-1.5"
                >
                  <span className="font-mono text-[8px] text-mint/50">
                    {j.total} URLs warmed
                  </span>
                  <span className="font-mono text-[7px] text-paper/20">
                    {new Date(j.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-3 space-y-2.5">
            {urlEntries.slice(0, 5).map((entry, i) => {
              const path = new URL(entry.url, "https://placeholder.com")
                .pathname;
              return (
                <div key={`${entry.url}-${i}`}>
                  <div className="flex items-center justify-between gap-2 font-mono text-[8px]">
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
          <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-2 font-mono text-[7px]">
            <span className="text-paper/20">
              {urlEntries.length > 5
                ? `+${urlEntries.length - 5} more`
                : `${urlEntries.length} URLs`}
            </span>
            <span className="text-paper/30">5 workers</span>
          </div>
        </>
      )}

      {/* Recent completed jobs summary */}
      {activeJobs.length > 0 && (
        <div className="mt-3 space-y-1">
          {activeJobs.map((job) => (
            <div
              key={job.id}
              className="flex items-center gap-2 rounded border border-white/5 bg-white/[0.02] px-2 py-1.5"
            >
              {job.status === "running" && (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-accent/60" />
              )}
              <span className="font-mono text-[8px] text-paper/40">
                {job.progress}/{job.total} URLs
              </span>
              <div className="ml-auto h-0.5 w-12 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{
                    width: `${job.total > 0 ? (job.progress / job.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
