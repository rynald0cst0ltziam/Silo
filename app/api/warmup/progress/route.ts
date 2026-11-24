import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { utcDay } from "@/lib/connector";

type UrlResult = { url: string; status: string; code?: number; ms?: number; cache?: string; error?: string };
type JobProgress = { job_id?: string; status?: string; total?: number; done?: number; failed?: number; results?: UrlResult[] };

const FINAL = new Set(["completed", "partial", "failed"]);

/**
 * Per-batch warmup results from the connector. Merged into the job so both dashboards
 * show URL-level progress while it runs.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<{ jobs?: JobProgress[] }>(req, { allowInactive: true });
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const jobs = Array.isArray(body.jobs) ? body.jobs.slice(0, 25) : [];
  let warmedNow = 0;

  for (const progress of jobs) {
    if (!progress.job_id) continue;
    const job = await prisma.warmupJob.findFirst({
      where: { id: progress.job_id, storeId: store.id },
      select: { id: true, results: true, startedAt: true, total: true, status: true },
    });
    if (!job) continue;

    const merged = new Map<string, UrlResult>();
    for (const r of (Array.isArray(job.results) ? job.results : []) as UrlResult[]) merged.set(r.url, r);
    for (const r of progress.results ?? []) {
      if (!r || typeof r.url !== "string") continue;
      if (!merged.has(r.url) && r.status === "warm") warmedNow += 1;
      merged.set(r.url, {
        url: r.url,
        status: String(r.status).slice(0, 12),
        code: Number(r.code) || 0,
        ms: Math.round(Number(r.ms) || 0),
        cache: r.cache ? String(r.cache).slice(0, 12) : "",
        error: r.error ? String(r.error).slice(0, 160) : "",
      });
    }

    const status = progress.status && ["running", ...FINAL].includes(progress.status) ? progress.status : "running";
    await prisma.warmupJob.update({
      where: { id: job.id },
      data: {
        status,
        progress: Math.max(0, Number(progress.done) || 0),
        failed: Math.max(0, Number(progress.failed) || 0),
        total: Math.max(job.total, Number(progress.total) || 0),
        results: [...merged.values()],
        startedAt: job.startedAt ?? new Date(),
        ...(FINAL.has(status) ? { completedAt: new Date(), error: status === "completed" ? null : `${progress.failed ?? 0} URLs failed after retry` } : {}),
      },
    });
  }

  if (warmedNow > 0) {
    const day = utcDay();
    await prisma.metric.upsert({
      where: { storeId_date: { storeId: store.id, date: day } },
      update: { warms: { increment: warmedNow } },
      create: { storeId: store.id, date: day, warms: warmedNow },
    });
  }

  await prisma.store.update({ where: { id: store.id }, data: { lastSeenAt: new Date() } });
  return NextResponse.json({ ok: true });
}
