import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, apiKey: true },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: { urls?: string[]; purgeAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { urls, purgeAll } = body;

  if (!purgeAll && (!urls || urls.length === 0)) {
    return NextResponse.json(
      { error: "Provide urls array or purgeAll: true" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  const tier = getUserTier(user?.subscription ?? null);

  let purgeUrls: string[];

  if (purgeAll) {
    purgeUrls = [`${store.url.replace(/\/+$/, "")}/*`];
  } else {
    purgeUrls = urls!.slice(0, 500);
  }

  const warmUrls = purgeUrls
    .filter((u) => !u.includes("*"))
    .slice(0, tier.warmupUrlsPerEvent);

  const event = await prisma.event.create({
    data: {
      storeId: id,
      type: "manual_purge",
      payload: { purgeAll: !!purgeAll, urlCount: purgeUrls.length },
      purgeUrls,
      warmUrls,
      processed: true,
    },
  });

  const updateData: Record<string, unknown> = {
    lastEventAt: new Date(),
    monthlyEvents: { increment: 1 },
  };

  if (purgeAll) {
    updateData.hitRate = 0;
  }

  await prisma.store.update({
    where: { id },
    data: updateData,
  });

  if (purgeAll) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    await prisma.metric.upsert({
      where: { storeId_date: { storeId: id, date: today } },
      update: { hits: 0, misses: 0 },
      create: { storeId: id, date: today, hits: 0, misses: 0 },
    });
  }

  if (warmUrls.length > 0) {
    await prisma.warmupJob.create({
      data: {
        storeId: id,
        urls: warmUrls,
        total: warmUrls.length,
        status: "pending",
      },
    });
  }

  // Send purge command to the connector
  let connectorResult: { purged?: number; error?: string } = {};
  try {
    const storeUrl = store.url.replace(/\/+$/, "");
    const purgeBody = JSON.stringify(purgeAll ? {} : { urls: purgeUrls });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", store.apiKey)
      .update(`${timestamp}.${purgeBody}`)
      .digest("hex");

    const connectorResp = await fetch(`${storeUrl}/wp-json/silo/v1/purge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Silo-Signature": signature,
        "X-Silo-Timestamp": timestamp,
        "X-Silo-Store-Key": store.apiKey,
      },
      body: purgeBody,
      signal: AbortSignal.timeout(10000),
    });

    if (connectorResp.ok) {
      connectorResult = await connectorResp.json();
    } else {
      connectorResult = { error: `HTTP ${connectorResp.status}` };
    }
  } catch (err) {
    connectorResult = {
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }

  // Also reset connector stats if purgeAll
  if (purgeAll) {
    try {
      const resetBody = JSON.stringify({});
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = createHmac("sha256", store.apiKey)
        .update(`${timestamp}.${resetBody}`)
        .digest("hex");

      const storeUrl = store.url.replace(/\/+$/, "");
      await fetch(`${storeUrl}/wp-json/silo/v1/reset-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Silo-Signature": signature,
          "X-Silo-Timestamp": timestamp,
          "X-Silo-Store-Key": store.apiKey,
        },
        body: resetBody,
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Non-critical — stats will reset on next heartbeat
    }
  }

  return NextResponse.json({
    event_id: event.id,
    purged: purgeUrls.length,
    warming: warmUrls.length,
    connector: connectorResult,
  });
}
