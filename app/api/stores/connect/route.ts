import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyConnectorRequest } from "@/lib/hmac";
import { getUserTier } from "@/lib/tier-enforcement";
import { rateLimit } from "@/lib/rate-limit";
import {
  generateConfig,
  detectCacheConflicts,
  type StoreSnapshot,
} from "@/lib/config-engine";

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

  const body = await cloned.json();
  const snapshot = body.snapshot as StoreSnapshot | undefined;

  if (!snapshot?.url) {
    return NextResponse.json({ error: "Missing or invalid snapshot" }, { status: 400 });
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { configVersion: true },
  });

  const tier = getUserTier(user.subscription);
  const config = generateConfig(tier, snapshot, store?.configVersion ?? 0);
  const cacheConflict = detectCacheConflicts(snapshot.existing_cache);

  await prisma.store.update({
    where: { id: storeId },
    data: {
      status: "optimized",
      profile: JSON.parse(JSON.stringify(snapshot)),
      config: JSON.parse(JSON.stringify(config)),
      configVersion: config.version,
      lastScanAt: new Date(),
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({
    status: "connected",
    config,
    ...(cacheConflict.hasConflict
      ? {
          warning: {
            type: "cache_conflict",
            plugin: cacheConflict.plugin,
            instructions: cacheConflict.instructions,
          },
        }
      : {}),
  });
}
