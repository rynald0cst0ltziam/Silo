import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";

type StoreRef = { id: string; url: string; apiKey: string };

export type ConnectorStats = {
  epoch: string;
  since?: number;
  hits: number;
  misses: number;
  stale?: number;
  bypass: number;
  hit_ms?: number;
  hit_n?: number;
  miss_ms?: number;
  miss_n?: number;
  api_hits?: number;
  api_misses?: number;
  total?: number;
  hit_rate?: number;
  avg_hit_ms?: number;
  avg_miss_ms?: number;
  api_hit_rate?: number;
  cached_pages?: number;
  cache_bytes?: number;
  api_entries?: number;
  updated?: number;
};

export type HeartbeatPayload = {
  stats?: ConnectorStats;
  warmup?: { queued?: number; warming?: number; warm_24h?: number; failed_24h?: number; avg_ms?: number };
  events?: { queued?: number };
  env?: Record<string, unknown>;
  scan?: Record<string, unknown> | null;
  connector_version?: string;
  config_version?: number;
  site?: Record<string, unknown>;
  sent_at?: number;
};

export function storeOrigin(url: string): string {
  return url.replace(/\/+$/, "");
}

export function utcDay(date = new Date()): Date {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

/**
 * Signed request from Silo to the connector's /wp-json/silo/v1 endpoints.
 */
export async function callConnector<T = Record<string, unknown>>(
  store: StoreRef,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  timeoutMs = 10_000,
): Promise<{ ok: true; status: number; data: T } | { ok: false; status: number; error: string }> {
  const payload = method === "GET" ? "" : JSON.stringify(body ?? {});
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", store.apiKey).update(`${timestamp}.${payload}`).digest("hex");

  try {
    const res = await fetch(`${storeOrigin(store.url)}/wp-json/silo/v1${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Silo-Signature": signature,
        "X-Silo-Timestamp": timestamp,
        "User-Agent": "Silo/1.0 (+https://getsilo.io)",
      },
      body: method === "GET" ? undefined : payload,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = null;
    }
    if (!res.ok || data === null) {
      const message =
        data && typeof data === "object" && "message" in data
          ? String((data as { message: unknown }).message)
          : `Connector responded with HTTP ${res.status}`;
      return { ok: false, status: res.status, error: message };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? (err.name === "TimeoutError" ? "Connector did not respond in time" : err.message) : "Connection failed",
    };
  }
}

/**
 * Ingest a connector heartbeat.
 *
 * Counters are cumulative per epoch. The previous snapshot is swapped atomically in a
 * single SQL statement (row lock, conditional on the new total not going backwards), and
 * the delta is added to today's metric. Out-of-order or duplicated heartbeats can never
 * double count; a reset (new epoch) is treated as a fresh start.
 */
export async function ingestHeartbeat(storeId: string, payload: HeartbeatPayload) {
  const now = new Date();
  const stats = payload.stats;

  const baseUpdate: Prisma.StoreUpdateInput = {
    lastSeenAt: now,
    ...(payload.connector_version ? { connectorVersion: String(payload.connector_version).slice(0, 20) } : {}),
    ...(payload.env ? { connectorEnv: payload.env as Prisma.InputJsonValue } : {}),
    ...(payload.scan ? { scanState: payload.scan as Prisma.InputJsonValue } : {}),
  };

  if (!stats || typeof stats.epoch !== "string") {
    await prisma.store.update({ where: { id: storeId }, data: baseUpdate });
    return { accepted: false };
  }

  const hits = Math.max(0, Math.floor(Number(stats.hits) || 0));
  const misses = Math.max(0, Math.floor(Number(stats.misses) || 0));
  const bypass = Math.max(0, Math.floor(Number(stats.bypass) || 0));
  const total = hits + misses + bypass;

  const snapshot = {
    ...stats,
    hits,
    misses,
    bypass,
    total,
    warmup: payload.warmup ?? null,
    events_queued: payload.events?.queued ?? 0,
    received_at: now.toISOString(),
  };

  const rows = await prisma.$queryRaw<Array<{ old: Record<string, unknown> | null }>>`
    WITH prev AS (
      SELECT "stats" AS old FROM "Store" WHERE "id" = ${storeId} FOR UPDATE
    )
    UPDATE "Store" s
       SET "stats" = ${JSON.stringify(snapshot)}::jsonb
      FROM prev
     WHERE s."id" = ${storeId}
       AND (
         prev.old IS NULL
         OR prev.old->>'epoch' IS DISTINCT FROM ${stats.epoch}
         OR COALESCE((prev.old->>'total')::bigint, 0) <= ${total}
       )
    RETURNING prev.old AS old
  `;

  if (rows.length === 0) {
    await prisma.store.update({ where: { id: storeId }, data: baseUpdate });
    return { accepted: false };
  }

  const old = rows[0].old;
  const sameEpoch = old && old.epoch === stats.epoch;
  const delta = {
    hits: sameEpoch ? Math.max(0, hits - Number(old.hits || 0)) : hits,
    misses: sameEpoch ? Math.max(0, misses - Number(old.misses || 0)) : misses,
    bypasses: sameEpoch ? Math.max(0, bypass - Number(old.bypass || 0)) : bypass,
  };

  const served = hits + misses;
  const day = utcDay(now);

  await prisma.$transaction([
    prisma.store.update({
      where: { id: storeId },
      data: { ...baseUpdate, hitRate: served > 0 ? hits / served : 0 },
    }),
    prisma.metric.upsert({
      where: { storeId_date: { storeId, date: day } },
      update: {
        hits: { increment: delta.hits },
        misses: { increment: delta.misses },
        bypasses: { increment: delta.bypasses },
      },
      create: { storeId, date: day, hits: delta.hits, misses: delta.misses, bypasses: delta.bypasses },
    }),
  ]);

  return { accepted: true, delta };
}

const lastPull = new Map<string, number>();

/**
 * When a dashboard is open and the connector has been quiet, ask it directly for a
 * fresh status so the numbers on screen are live even on a store with no traffic.
 */
export async function pullConnectorIfQuiet(
  store: StoreRef & { lastSeenAt: Date | null },
  quietMs = 25_000,
): Promise<boolean> {
  const seenAgo = store.lastSeenAt ? Date.now() - store.lastSeenAt.getTime() : Infinity;
  const pulledAgo = Date.now() - (lastPull.get(store.id) ?? 0);
  if (seenAgo < quietMs || pulledAgo < 12_000) return false;

  lastPull.set(store.id, Date.now());
  const result = await callConnector<HeartbeatPayload>(store, "GET", "/status", undefined, 4_000);
  if (!result.ok) return false;

  await ingestHeartbeat(store.id, result.data);
  return true;
}
