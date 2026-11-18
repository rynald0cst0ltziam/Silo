import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyConnectorRequest } from "@/lib/hmac";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const cloned = req.clone();
  const verified = await verifyConnectorRequest(req);

  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeId } = verified;

  const rl = rateLimit(req, storeId);
  if (!rl.allowed) return rl.response!;
  const body = await cloned.json();

  const { hits, misses, purges, warms, date } = body;

  if (typeof hits !== "number" || typeof misses !== "number") {
    return NextResponse.json({ error: "Missing hits/misses" }, { status: 400 });
  }

  const metricDate = date ? new Date(date) : new Date();
  metricDate.setUTCHours(0, 0, 0, 0);

  await prisma.metric.upsert({
    where: {
      storeId_date: {
        storeId,
        date: metricDate,
      },
    },
    update: {
      hits: { increment: hits },
      misses: { increment: misses },
      ...(typeof purges === "number" ? { purges: { increment: purges } } : {}),
      ...(typeof warms === "number" ? { warms: { increment: warms } } : {}),
    },
    create: {
      storeId,
      date: metricDate,
      hits,
      misses,
      purges: purges ?? 0,
      warms: warms ?? 0,
    },
  });

  // Compute weighted hit rate from recent 7 days
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setUTCHours(0, 0, 0, 0);

  const recentMetrics = await prisma.metric.findMany({
    where: {
      storeId,
      date: { gte: weekAgo },
    },
    select: { hits: true, misses: true },
  });

  const totalHits = recentMetrics.reduce((s, m) => s + m.hits, 0);
  const totalMisses = recentMetrics.reduce((s, m) => s + m.misses, 0);
  const total = totalHits + totalMisses;
  const hitRate = total > 0 ? totalHits / total : 0;

  await prisma.store.update({
    where: { id: storeId },
    data: {
      hitRate,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({ recorded: true, hitRate });
}
