import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyConnectorRequest } from "@/lib/hmac";
import { getUserTier, canProcessEvent } from "@/lib/tier-enforcement";
import { resolveInvalidation } from "@/lib/invalidation-engine";
import { rateLimit } from "@/lib/rate-limit";
import type { SiloConfig } from "@/lib/config-engine";

const recentEvents = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000;

setInterval(() => {
  const cutoff = Date.now() - DEDUP_WINDOW_MS * 2;
  for (const [key, ts] of recentEvents) {
    if (ts < cutoff) recentEvents.delete(key);
  }
}, 30000);

export async function POST(req: Request) {
  const cloned = req.clone();
  const verified = await verifyConnectorRequest(req);

  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeId, userId } = verified;

  const rl = rateLimit(req, storeId);
  if (!rl.allowed) return rl.response!;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getUserTier(user.subscription);
  const eventCheck = await canProcessEvent(storeId, tier);

  if (!eventCheck.allowed) {
    return NextResponse.json(
      {
        error: `Monthly event limit reached (${eventCheck.used}/${eventCheck.max})`,
        code: "EVENT_LIMIT",
      },
      { status: 429 },
    );
  }

  const body = await cloned.json();
  const { type, payload } = body;

  if (!type || !payload) {
    return NextResponse.json({ error: "Missing type or payload" }, { status: 400 });
  }

  const dedupKey = `${storeId}:${type}:${payload.product_id ?? payload.order_id ?? "global"}`;
  const lastSeen = recentEvents.get(dedupKey);
  if (lastSeen && Date.now() - lastSeen < DEDUP_WINDOW_MS) {
    return NextResponse.json({ deduplicated: true });
  }
  recentEvents.set(dedupKey, Date.now());

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: {
      url: true,
      config: true,
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const config = store.config as unknown as SiloConfig | null;
  const storeUrl = store.url.replace(/\/+$/, "");

  let purgeUrls: string[] = [];
  let warmUrls: string[] = [];

  if (config) {
    const result = resolveInvalidation(type, payload, config, storeUrl);
    purgeUrls = result.purge;
    warmUrls = result.warm;
  } else {
    purgeUrls = extractBasicPurgeUrls(type, payload);
    warmUrls = purgeUrls.slice(0, tier.warmupUrlsPerEvent);
  }

  const event = await prisma.event.create({
    data: {
      storeId,
      type,
      payload,
      purgeUrls,
      warmUrls,
      processed: true,
    },
  });

  await prisma.store.update({
    where: { id: storeId },
    data: {
      lastEventAt: new Date(),
      monthlyEvents: { increment: 1 },
    },
  });

  if (warmUrls.length > 0) {
    await prisma.warmupJob.create({
      data: {
        storeId,
        urls: warmUrls,
        total: warmUrls.length,
        status: "pending",
      },
    });
  }

  return NextResponse.json({
    event_id: event.id,
    purge: purgeUrls,
    warm: warmUrls,
  });
}

function extractBasicPurgeUrls(
  type: string,
  payload: Record<string, unknown>,
): string[] {
  const urls: string[] = [];

  const url = payload.url as string | undefined;
  if (url) urls.push(url);

  const categories = payload.categories as string[] | undefined;
  if (categories) urls.push(...categories);

  if (type === "order_status_changed") {
    const products = payload.products as Array<{
      url?: string;
      categories?: string[];
    }>;
    if (products) {
      for (const p of products) {
        if (p.url) urls.push(p.url);
        if (p.categories) urls.push(...p.categories);
      }
    }
  }

  return [...new Set(urls)];
}
