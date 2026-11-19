import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyConnectorRequest } from "@/lib/hmac";

export async function POST(req: Request) {
  const cloned = req.clone();
  const verified = await verifyConnectorRequest(req);

  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeId } = verified;

  let stats: { hits?: number; misses?: number; cached_pages?: number; hit_rate?: number } = {};
  let delta: { hits?: number; misses?: number } = {};
  try {
    const body = await cloned.json();
    stats = body.stats ?? {};
    delta = body.delta ?? {};
  } catch {
    // No body is fine — just update lastSeenAt
  }

  const cumulativeHits = stats.hits ?? 0;
  const cumulativeMisses = stats.misses ?? 0;
  const total = cumulativeHits + cumulativeMisses;
  const hitRate = total > 0 ? cumulativeHits / total : 0;

  const deltaHits = delta.hits ?? 0;
  const deltaMisses = delta.misses ?? 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  await prisma.$transaction([
    prisma.store.update({
      where: { id: storeId },
      data: {
        lastSeenAt: new Date(),
        hitRate,
      },
    }),
    prisma.metric.upsert({
      where: { storeId_date: { storeId, date: today } },
      update: {
        hits: { increment: deltaHits },
        misses: { increment: deltaMisses },
      },
      create: {
        storeId,
        date: today,
        hits: deltaHits,
        misses: deltaMisses,
      },
    }),
  ]);

  return NextResponse.json({
    status: "ok",
    lastSeenAt: new Date().toISOString(),
  });
}
