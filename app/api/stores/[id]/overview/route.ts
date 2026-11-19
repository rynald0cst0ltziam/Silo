import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
  });

  if (!store) return NextResponse.json({ error: "not found" }, { status: 404 });

  const tier = user.subscription ? getTier(user.subscription.tier) : null;

  const [recentEvents, metrics, warmupJobs] = await Promise.all([
    prisma.event.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.metric.findMany({
      where: { storeId: store.id },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.warmupJob.findMany({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const chartData = metrics.map((m) => ({
    date: new Date(m.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    hits: m.hits,
    misses: m.misses,
    hitRate: m.hits + m.misses > 0 ? (m.hits / (m.hits + m.misses)) * 100 : 0,
  }));

  const maxEvents = tier?.maxMonthlyEvents ?? 100_000;

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentInvalidations = recentEvents.filter(
    (e) => new Date(e.createdAt) >= twentyFourHoursAgo
  );

  const activeWarmups = warmupJobs.filter(
    (j) => j.status === "pending" || j.status === "running"
  );
  const totalWarmupUrls = activeWarmups.reduce((s, j) => s + j.total, 0);

  const eventLogData = recentEvents.slice(0, 20).map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload as Record<string, unknown> | null,
    purgeUrls: Array.isArray(e.purgeUrls) ? (e.purgeUrls as string[]) : [],
    warmUrls: Array.isArray(e.warmUrls) ? (e.warmUrls as string[]) : [],
    processed: e.processed,
    createdAt: e.createdAt.toISOString(),
  }));

  const warmupData = warmupJobs.map((j) => ({
    id: j.id,
    status: j.status,
    progress: j.progress,
    total: j.total,
    urls: Array.isArray(j.urls) ? (j.urls as string[]).slice(0, 10) : [],
    createdAt: j.createdAt.toISOString(),
  }));

  return NextResponse.json({
    store: {
      id: store.id,
      url: store.url,
      status: store.status,
      hitRate: store.hitRate,
      monthlyEvents: store.monthlyEvents,
      lastSeenAt: store.lastSeenAt?.toISOString() ?? null,
      lastEventAt: store.lastEventAt?.toISOString() ?? null,
    },
    chartData,
    maxEvents,
    recentInvalidationCount: recentInvalidations.length,
    activeWarmupCount: activeWarmups.length,
    totalWarmupUrls,
    eventLogData,
    warmupData,
  });
}
