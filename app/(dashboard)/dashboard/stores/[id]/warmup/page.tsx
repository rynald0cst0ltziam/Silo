import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WarmupProgress } from "@/components/warmup-progress";

export const metadata: Metadata = {
  title: "Warmup",
  robots: { index: false, follow: false },
};

export default async function StoreWarmupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!store) notFound();

  const warmupJobs = await prisma.warmupJob.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const jobData = warmupJobs.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    total: j.total,
    urls: Array.isArray(j.urls) ? (j.urls as string[]) : [],
    createdAt: j.createdAt.toISOString(),
  }));

  const active = jobData.filter(
    (j) => j.status === "pending" || j.status === "running"
  );
  const completed = jobData.filter((j) => j.status === "completed");
  const failed = jobData.filter(
    (j) => j.status === "failed" || j.status === "partial"
  );

  const totalWarmed = completed.reduce((s, j) => s + j.total, 0);

  return (
    <div>
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-paper">
          Warmup
        </h2>
        <p className="mt-0.5 font-mono text-[9px] text-paper/25">
          Cache warmup queue and job history
        </p>
      </div>

      {/* Stats */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label="Active jobs" value={String(active.length)} />
        <StatCard
          label="URLs in queue"
          value={String(active.reduce((s, j) => s + (j.total - j.progress), 0))}
        />
        <StatCard label="Total warmed" value={totalWarmed.toLocaleString()} />
        <StatCard label="Failed" value={String(failed.length)} />
      </div>

      {/* Active jobs */}
      {active.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[12px] font-medium text-paper/70">
            Active jobs
          </h3>
          <div className="mt-3 space-y-3">
            {active.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-white/8 bg-[#0b0d11] p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] text-paper/50">
                    {job.progress}/{job.total} URLs
                  </span>
                  <span className="font-mono text-[8px] uppercase text-accent/60">
                    {job.status}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{
                      width: `${job.total > 0 ? (job.progress / job.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                {/* URL list */}
                <div className="mt-3 space-y-1">
                  {job.urls.slice(0, 8).map((url, i) => {
                    let path: string;
                    try {
                      path = new URL(url).pathname;
                    } catch {
                      path = url;
                    }
                    return (
                      <div
                        key={i}
                        className="flex items-center justify-between font-mono text-[8px]"
                      >
                        <span className="truncate text-paper/30">{path}</span>
                      </div>
                    );
                  })}
                  {job.urls.length > 8 && (
                    <span className="font-mono text-[7px] text-paper/20">
                      +{job.urls.length - 8} more
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-white/6 pt-2 font-mono text-[7px] text-paper/20">
                  <span>5 concurrent workers</span>
                  <span>
                    Started{" "}
                    {new Date(job.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job history */}
      <div className="mt-5">
        <h3 className="text-[12px] font-medium text-paper/70">Job history</h3>
        <div className="mt-3">
          <WarmupProgress
            jobs={jobData.map((j) => ({
              id: j.id,
              status: j.status,
              progress: j.progress,
              total: j.total,
              createdAt: j.createdAt,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3 py-3">
      <p className="font-mono text-[7px] uppercase tracking-wider text-paper/25">
        {label}
      </p>
      <p className="mt-1 font-mono text-[18px] font-semibold text-paper">
        {value}
      </p>
    </div>
  );
}
