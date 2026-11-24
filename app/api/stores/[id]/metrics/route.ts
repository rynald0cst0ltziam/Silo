import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const days = Math.min(Number(url.searchParams.get("days") ?? "30"), 90);

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  const metrics = await prisma.metric.findMany({
    where: {
      storeId: id,
      date: { gte: since },
    },
    orderBy: { date: "asc" },
  });

  const data = metrics.map((m) => {
    const total = m.hits + m.misses;
    return {
      date: m.date.toISOString().split("T")[0],
      hits: m.hits,
      misses: m.misses,
      purges: m.purges,
      warms: m.warms,
      eventsUsed: m.eventsUsed,
      hitRate: total > 0 ? Math.round((m.hits / total) * 1000) / 10 : 0,
    };
  });

  // Summary stats
  const totalHits = metrics.reduce((s, m) => s + m.hits, 0);
  const totalMisses = metrics.reduce((s, m) => s + m.misses, 0);
  const totalPurges = metrics.reduce((s, m) => s + m.purges, 0);
  const totalWarms = metrics.reduce((s, m) => s + m.warms, 0);
  const totalRequests = totalHits + totalMisses;

  return NextResponse.json({
    days,
    data,
    summary: {
      totalHits,
      totalMisses,
      totalPurges,
      totalWarms,
      totalRequests,
      avgHitRate: totalRequests > 0 ? Math.round((totalHits / totalRequests) * 1000) / 10 : 0,
    },
  });
}
