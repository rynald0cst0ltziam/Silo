"use client";

import { Loader2 } from "lucide-react";

interface WarmupJobSummary {
  id: string;
  status: string;
  progress: number;
  total: number;
  createdAt: string;
}

export function WarmupProgress({ jobs }: { jobs: WarmupJobSummary[] }) {
  if (jobs.length === 0) {
    return (
      <p className="text-[13px] text-paper/30">No warmup jobs.</p>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => {
        const pct = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;
        const isRunning = job.status === "running";

        return (
          <div
            key={job.id}
            className="flex items-center gap-3 rounded border border-white/5 bg-white/[0.02] px-3 py-2"
          >
            {isRunning && (
              <Loader2 className="h-3 w-3 animate-spin text-accent/60" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[13px] text-paper/50">
                  {job.total} URLs
                </span>
                <StatusLabel status={job.status} />
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full rounded-full transition-all ${
                    job.status === "completed"
                      ? "bg-mint"
                      : job.status === "failed"
                        ? "bg-red-500"
                        : "bg-accent"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
            <span className="font-mono text-[10px] text-paper/25">
              {new Date(job.createdAt).toLocaleTimeString()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "text-paper/30",
    running: "text-accent/60",
    completed: "text-mint/60",
    failed: "text-red-400/60",
    partial: "text-amber-400/60",
  };

  return (
    <span className={`font-mono text-[10px] uppercase ${styles[status] ?? "text-paper/30"}`}>
      {status}
    </span>
  );
}
