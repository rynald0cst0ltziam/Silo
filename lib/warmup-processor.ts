import { prisma } from "@/lib/prisma";

const CONCURRENCY_LIMITS: Record<string, number> = {
  small: 5,
  medium: 10,
  large: 20,
};

function getConcurrency(productCount: number): number {
  if (productCount > 10000) return CONCURRENCY_LIMITS.large;
  if (productCount > 1000) return CONCURRENCY_LIMITS.medium;
  return CONCURRENCY_LIMITS.small;
}

async function fetchUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Silo-Warmup/1.0",
        "X-Silo-Warmup": "1",
      },
      signal: AbortSignal.timeout(15000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function warmBatch(urls: string[], concurrency: number): Promise<{ warmed: number; failed: string[] }> {
  let warmed = 0;
  const failed: string[] = [];

  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const results = await Promise.allSettled(batch.map(fetchUrl));

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        warmed++;
      } else {
        failed.push(batch[j]);
      }
    }
  }

  return { warmed, failed };
}

export async function processWarmupJobs(maxJobs: number = 10): Promise<{
  processed: number;
  totalWarmed: number;
  totalFailed: number;
}> {
  const jobs = await prisma.warmupJob.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: maxJobs,
    include: {
      store: {
        select: { profile: true },
      },
    },
  });

  let totalWarmed = 0;
  let totalFailed = 0;

  for (const job of jobs) {
    await prisma.warmupJob.update({
      where: { id: job.id },
      data: { status: "running" },
    });

    const profile = job.store.profile as Record<string, unknown> | null;
    const productCount = (profile?.product_count as number) ?? 0;
    const concurrency = getConcurrency(productCount);
    const urls = job.urls as string[];

    const { warmed, failed } = await warmBatch(urls, concurrency);

    // Retry failed URLs once
    let retryWarmed = 0;
    if (failed.length > 0) {
      const retry = await warmBatch(failed, concurrency);
      retryWarmed = retry.warmed;
    }

    const totalJobWarmed = warmed + retryWarmed;
    const totalJobFailed = failed.length - retryWarmed;
    totalWarmed += totalJobWarmed;
    totalFailed += totalJobFailed;

    const finalStatus = totalJobFailed === 0
      ? "completed"
      : totalJobWarmed > 0
        ? "partial"
        : "failed";

    await prisma.warmupJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        progress: totalJobWarmed,
        completedAt: new Date(),
        ...(totalJobFailed > 0 ? { error: `${totalJobFailed} URLs failed after retry` } : {}),
      },
    });

    // Update daily metric
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.metric.upsert({
      where: {
        storeId_date: { storeId: job.storeId, date: today },
      },
      create: {
        storeId: job.storeId,
        date: today,
        warms: totalJobWarmed,
      },
      update: {
        warms: { increment: totalJobWarmed },
      },
    });
  }

  return { processed: jobs.length, totalWarmed, totalFailed };
}

export async function runDailyPriorityWarmup(): Promise<{
  stores: number;
  totalWarmed: number;
}> {
  const stores = await prisma.store.findMany({
    where: {
      status: "optimized",
      config: { not: null },
    },
    select: {
      id: true,
      url: true,
      config: true,
      profile: true,
    },
  });

  let totalWarmed = 0;

  for (const store of stores) {
    const config = store.config as Record<string, unknown> | null;
    if (!config) continue;

    const priorityUrls = config.priority_urls as string[] | undefined;
    if (!priorityUrls?.length) continue;

    const profile = store.profile as Record<string, unknown> | null;
    const productCount = (profile?.product_count as number) ?? 0;
    const concurrency = getConcurrency(productCount);

    const { warmed } = await warmBatch(priorityUrls, concurrency);
    totalWarmed += warmed;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await prisma.metric.upsert({
      where: {
        storeId_date: { storeId: store.id, date: today },
      },
      create: {
        storeId: store.id,
        date: today,
        warms: warmed,
      },
      update: {
        warms: { increment: warmed },
      },
    });
  }

  return { stores: stores.length, totalWarmed };
}
