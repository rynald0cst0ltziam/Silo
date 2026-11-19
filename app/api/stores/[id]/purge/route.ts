import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { callConnector, utcDay } from "@/lib/connector";
import type { SiloConfig } from "@/lib/config-engine";
import type { Prisma } from "@/lib/generated/prisma/client";

type PurgeResponse = { purged?: number; urls?: number; type?: string; stats?: Record<string, unknown> };

/**
 * Purge from the dashboard. "All" clears every cached page and Store API entry on the
 * store, resets statistics on both sides, and re-warms priority pages.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, apiKey: true, config: true },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  let body: { urls?: string[]; purgeAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const urls = (body.urls ?? []).filter((u) => typeof u === "string").slice(0, 500);
  if (!body.purgeAll && urls.length === 0) {
    return NextResponse.json({ error: "Provide urls or purgeAll: true" }, { status: 400 });
  }

  const result = await callConnector<PurgeResponse>(store, "POST", "/purge", body.purgeAll ? { all: true, reset_stats: true } : { urls });
  if (!result.ok) {
    return NextResponse.json(
      { error: `The connector could not be reached (${result.error}). Nothing was purged — run Purge all from WooCommerce → Silo instead.` },
      { status: 502 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { subscription: true } });
  const tier = getUserTier(user?.subscription ?? null);
  const config = store.config as unknown as SiloConfig | null;
  const warmUrls = body.purgeAll ? (config?.priority_urls ?? []).slice(0, tier.warmupUrlsPerEvent) : urls.slice(0, tier.warmupUrlsPerEvent);
  const purged = Number(result.data.purged ?? 0);
  const now = new Date();

  const event = await prisma.event.create({
    data: {
      storeId: id,
      type: body.purgeAll ? "purge.all" : "manual.purge",
      object: body.purgeAll ? "Purged from Silo dashboard" : `${urls.length} URLs purged from Silo dashboard`,
      detail: `${purged.toLocaleString()} cached entries removed${body.purgeAll ? " · stats reset" : ""}`,
      payload: { purgeAll: !!body.purgeAll, urlCount: urls.length, purged },
      purgeUrls: body.purgeAll ? [] : urls,
      warmUrls,
      processed: true,
      counted: !body.purgeAll,
      durationMs: 1,
    },
  });

  let jobId: string | null = null;
  if (warmUrls.length) {
    const job = await prisma.warmupJob.create({
      data: { storeId: id, urls: warmUrls, total: warmUrls.length, status: "pending", source: "purge", eventId: event.id },
    });
    jobId = job.id;
    await callConnector(store, "POST", "/warm", { urls: warmUrls, job_id: job.id, source: "purge" });
  }

  const day = utcDay(now);
  await prisma.$transaction([
    prisma.store.update({
      where: { id },
      data: {
        lastEventAt: now,
        ...(body.purgeAll
          ? { hitRate: 0, ...(result.data.stats ? { stats: result.data.stats as Prisma.InputJsonValue } : {}) }
          : { monthlyEvents: { increment: 1 } }),
      },
    }),
    prisma.metric.upsert({
      where: { storeId_date: { storeId: id, date: day } },
      update: body.purgeAll ? { hits: 0, misses: 0, bypasses: 0, purges: { increment: purged } } : { purges: { increment: purged }, eventsUsed: { increment: 1 } },
      create: { storeId: id, date: day, purges: purged, eventsUsed: body.purgeAll ? 0 : 1 },
    }),
  ]);

  return NextResponse.json({ event_id: event.id, purged, warming: warmUrls.length, warmup_job_id: jobId });
}
