import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { getUserTier } from "@/lib/tier-enforcement";
import { callConnector, utcDay } from "@/lib/connector";
import type { WarmResult } from "@/lib/store-live";

const STALE_PENDING_MS = 10 * 60 * 1000;

async function fetchUrl(url: string): Promise<WarmResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SiloWarmup/2; +https://getsilo.io)" },
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    await res.arrayBuffer();
    const cache = (res.headers.get("x-silo-cache") ?? "").toUpperCase();
    return {
      url,
      status: res.status === 200 ? (cache ? "warm" : "skipped") : "failed",
      code: res.status,
      ms: Date.now() - started,
      cache,
      error: res.status === 200 ? (cache ? "" : "Not a cacheable WooCommerce page") : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { url, status: "failed", code: 0, ms: Date.now() - started, error: err instanceof Error ? err.message : "Request failed" };
  }
}

/**
 * Fallback: the connector normally warms its own pages. Jobs it never picked up
 * (connector offline, background runner blocked) are warmed from here.
 */
export async function processWarmupJobs(maxJobs = 10) {
  const jobs = await prisma.warmupJob.findMany({
    where: { status: "pending", createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) } },
    orderBy: { createdAt: "asc" },
    take: maxJobs,
  });

  let totalWarmed = 0;
  let totalFailed = 0;

  for (const job of jobs) {
    await prisma.warmupJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), source: `${job.source}+fallback` } });

    const urls = (Array.isArray(job.urls) ? job.urls : []) as string[];
    const results: WarmResult[] = [];
    for (let i = 0; i < urls.length; i += 5) {
      results.push(...(await Promise.all(urls.slice(i, i + 5).map(fetchUrl))));
    }

    const warmed = results.filter((r) => r.status !== "failed").length;
    const failed = results.length - warmed;
    totalWarmed += warmed;
    totalFailed += failed;

    await prisma.warmupJob.update({
      where: { id: job.id },
      data: {
        status: failed === 0 ? "completed" : warmed > 0 ? "partial" : "failed",
        progress: warmed,
        failed,
        results: results as unknown as Prisma.InputJsonValue,
        completedAt: new Date(),
        error: failed ? `${failed} URLs failed (warmed by Silo fallback)` : null,
      },
    });

    if (warmed) {
      const day = utcDay();
      await prisma.metric.upsert({
        where: { storeId_date: { storeId: job.storeId, date: day } },
        update: { warms: { increment: warmed } },
        create: { storeId: job.storeId, date: day, warms: warmed },
      });
    }
  }

  return { processed: jobs.length, totalWarmed, totalFailed };
}

/**
 * Daily priority pass: bestsellers, shop and top categories, warmed by each connector.
 */
export async function runDailyPriorityWarmup() {
  const stores = await prisma.store.findMany({
    where: { status: "optimized", config: { not: Prisma.JsonNull } },
    select: { id: true, url: true, apiKey: true, config: true, user: { select: { subscription: true } } },
  });

  let queued = 0;
  for (const store of stores) {
    const config = store.config as { priority_urls?: string[] } | null;
    const tier = getUserTier(store.user.subscription);
    const urls = (config?.priority_urls ?? []).slice(0, tier.warmupUrlsPerEvent);
    if (!urls.length) continue;

    const job = await prisma.warmupJob.create({
      data: { storeId: store.id, urls, total: urls.length, status: "pending", source: "daily" },
    });
    const pushed = await callConnector(store, "POST", "/warm", { urls, job_id: job.id, source: "daily" });
    if (pushed.ok) queued += urls.length;
  }

  return { stores: stores.length, totalWarmed: queued };
}
