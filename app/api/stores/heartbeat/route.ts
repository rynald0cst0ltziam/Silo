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
  try {
    const body = await cloned.json();
    stats = body.stats ?? {};
  } catch {
    // No body is fine — just update lastSeenAt
  }

  const hits = stats.hits ?? 0;
  const misses = stats.misses ?? 0;
  const total = hits + misses;
  const hitRate = total > 0 ? hits / total : 0;

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
        hits,
        misses,
      },
      create: {
        storeId,
        date: today,
        hits,
        misses,
      },
    }),
  ]);

  return NextResponse.json({
    status: "ok",
    lastSeenAt: new Date().toISOString(),
  });
}
