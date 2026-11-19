import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { getUserTier } from "@/lib/tier-enforcement";
import { rateLimit } from "@/lib/rate-limit";
import { generateConfig, detectCacheConflicts, type StoreSnapshot } from "@/lib/config-engine";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Scan complete: turn the catalog snapshot into this store's cache profile, return it,
 * and queue the initial priority warmup.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<{ snapshot?: StoreSnapshot }>(req);
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const rl = rateLimit(req, store.id);
  if (!rl.allowed) return rl.response!;

  const snapshot = body.snapshot;
  if (!snapshot?.url || typeof snapshot.product_count !== "number") {
    return NextResponse.json({ error: "Missing or invalid catalog snapshot" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: store.userId }, include: { subscription: true } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const tier = getUserTier(user.subscription);
  const config = generateConfig(tier, snapshot, store.configVersion ?? 0);
  const conflict = detectCacheConflicts(snapshot.existing_cache);
  const warmUrls = config.priority_urls.slice(0, tier.warmupUrlsPerEvent);
  const now = new Date();

  let job: { id: string };
  try {
    [, job] = await Promise.all([
    prisma.store.update({
      where: { id: store.id },
      data: {
        status: "optimized",
        profile: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
        config: JSON.parse(JSON.stringify(config)) as Prisma.InputJsonValue,
        configVersion: config.version,
        lastScanAt: now,
        lastSeenAt: now,
        connectorVersion: snapshot.connector_version ? String(snapshot.connector_version).slice(0, 20) : undefined,
      },
    }),
    prisma.warmupJob.create({
      data: {
        storeId: store.id,
        urls: warmUrls,
        total: warmUrls.length,
        status: warmUrls.length ? "pending" : "completed",
        source: "scan",
        completedAt: warmUrls.length ? null : now,
      },
    }),
    prisma.event.create({
      data: {
        storeId: store.id,
        type: "system.scan",
        object: "Catalog scan",
        detail: `${snapshot.product_count.toLocaleString()} products · ${(snapshot.variation_count ?? 0).toLocaleString()} variations · ${(snapshot.archive_count ?? 0).toLocaleString()} archives`,
        payload: {
          product_count: snapshot.product_count,
          variation_count: snapshot.variation_count ?? 0,
          archive_count: snapshot.archive_count ?? 0,
          store_api_routes: snapshot.store_api_routes?.length ?? 0,
          graph: snapshot.graph ?? null,
          config_version: config.version,
        },
        purgeUrls: [],
        warmUrls,
        processed: true,
        counted: false,
        durationMs: snapshot.scan_ms ?? null,
      },
    }),
  ]);
  } catch (err) {
    console.error("[connect] failed to save profile", err);
    return NextResponse.json(
      { error: `Silo could not save the cache profile: ${err instanceof Error ? err.message.split(/\r?\n/)[0] : "unknown error"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    status: "connected",
    config,
    warmup: { job_id: job.id, urls: warmUrls },
    ...(conflict.hasConflict
      ? { warning: { type: "cache_conflict", plugin: conflict.plugin, instructions: conflict.instructions } }
      : {}),
  });
}
