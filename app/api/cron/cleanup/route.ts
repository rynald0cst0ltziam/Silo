import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stores = await prisma.store.findMany({
    select: {
      id: true,
      user: {
        select: {
          subscription: true,
        },
      },
    },
  });

  let totalEventsDeleted = 0;
  let totalMetricsDeleted = 0;
  let totalWarmupDeleted = 0;

  for (const store of stores) {
    const tier = getUserTier(store.user.subscription);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tier.logRetentionDays);

    const events = await prisma.event.deleteMany({
      where: {
        storeId: store.id,
        createdAt: { lt: cutoff },
      },
    });
    totalEventsDeleted += events.count;

    const metrics = await prisma.metric.deleteMany({
      where: {
        storeId: store.id,
        date: { lt: cutoff },
      },
    });
    totalMetricsDeleted += metrics.count;

    const warmup = await prisma.warmupJob.deleteMany({
      where: {
        storeId: store.id,
        createdAt: { lt: cutoff },
        status: { in: ["completed", "failed", "partial"] },
      },
    });
    totalWarmupDeleted += warmup.count;
  }

  return NextResponse.json({
    ok: true,
    stores: stores.length,
    eventsDeleted: totalEventsDeleted,
    metricsDeleted: totalMetricsDeleted,
    warmupJobsDeleted: totalWarmupDeleted,
  });
}
