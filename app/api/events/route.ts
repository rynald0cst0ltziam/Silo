import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { getUserTier } from "@/lib/tier-enforcement";
import { resolveInvalidation, type EventPayload } from "@/lib/invalidation-engine";
import { rateLimit } from "@/lib/rate-limit";
import { utcDay } from "@/lib/connector";
import type { SiloConfig, StoreSnapshot } from "@/lib/config-engine";
import type { Prisma } from "@/lib/generated/prisma/client";

type IncomingEvent = {
  ref?: string;
  type?: string;
  object?: string;
  detail?: string;
  payload?: EventPayload;
  occurred_at?: string;
  local_purged?: number;
  local_ms?: number;
};

const MAX_BATCH = 50;

/** Events that are logged but never count against the plan's event allowance. */
function isCounted(type: string): boolean {
  return !type.startsWith("system.") && type !== "purge.all";
}

/**
 * Receives catalog events from the connector (batched), walks the graph for each,
 * returns purge + warm plans and records everything for the invalidation log.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<{ events?: IncomingEvent[] } & IncomingEvent>(req);
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const rl = rateLimit(req, store.id);
  if (!rl.allowed) return rl.response!;

  const incoming: IncomingEvent[] = Array.isArray(body.events) ? body.events.slice(0, MAX_BATCH) : body.type ? [body] : [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "No events in request" }, { status: 400 });
  }

  const [user, record] = await Promise.all([
    prisma.user.findUnique({ where: { id: store.userId }, include: { subscription: true } }),
    prisma.store.findUnique({ where: { id: store.id }, select: { url: true, config: true, profile: true, monthlyEvents: true } }),
  ]);
  if (!user || !record) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const tier = getUserTier(user);
  const config = record.config as unknown as SiloConfig | null;
  const snapshot = record.profile as unknown as Partial<StoreSnapshot> | null;
  const warmCap = config?.limits?.warmup_urls_per_event ?? tier.warmupUrlsPerEvent;

  let used = record.monthlyEvents;
  let counted = 0;
  let purgedTotal = 0;
  const results: Array<Record<string, unknown>> = [];
  const now = new Date();

  for (const event of incoming) {
    const ref = String(event.ref ?? "");
    const type = String(event.type ?? "").slice(0, 48);
    if (!type) {
      results.push({ ref, error: "Missing event type" });
      continue;
    }

    // Connector retries after timeouts: an event already recorded is answered again, never re-counted.
    if (ref) {
      const existing = await prisma.event.findFirst({
        where: { storeId: store.id, meta: { path: ["ref"], equals: ref } },
        select: { id: true, purgeUrls: true, warmUrls: true, durationMs: true, meta: true },
      });
      if (existing) {
        const job = await prisma.warmupJob.findFirst({ where: { eventId: existing.id }, select: { id: true } });
        const meta = (existing.meta ?? {}) as { store_api?: unknown };
        results.push({
          ref,
          event_id: existing.id,
          purge: existing.purgeUrls ?? [],
          warm: existing.warmUrls ?? [],
          store_api: meta.store_api ?? { mode: "products", product_ids: [] },
          warmup_job_id: job?.id ?? null,
          duration_ms: existing.durationMs ?? 0,
          duplicate: true,
        });
        continue;
      }
    }

    const countsAgainstPlan = isCounted(type);
    if (countsAgainstPlan && used >= tier.maxMonthlyEvents) {
      results.push({ ref, error: `Monthly event limit reached (${used.toLocaleString()}/${tier.maxMonthlyEvents.toLocaleString()})`, code: "EVENT_LIMIT" });
      continue;
    }

    const started = performance.now();
    const payload = (event.payload ?? {}) as EventPayload;
    const plan = resolveInvalidation(type, payload, config, record.url, snapshot, warmCap);
    const durationMs = Math.max(1, Math.round(performance.now() - started));

    const created = await prisma.event.create({
      data: {
        storeId: store.id,
        type,
        object: event.object ? String(event.object).slice(0, 191) : null,
        detail: event.detail ? String(event.detail).slice(0, 191) : null,
        payload: payload as Prisma.InputJsonValue,
        purgeUrls: plan.purge,
        warmUrls: plan.warm,
        processed: true,
        durationMs,
        localMs: typeof event.local_ms === "number" ? Math.round(event.local_ms) : null,
        counted: countsAgainstPlan,
        meta: {
          ref,
          scope: plan.scope,
          store_api: plan.store_api,
          local_purged: event.local_purged ?? 0,
          occurred_at: event.occurred_at ?? null,
        },
        createdAt: event.occurred_at && !Number.isNaN(Date.parse(event.occurred_at)) ? new Date(event.occurred_at) : now,
      },
    });

    let warmupJobId: string | null = null;
    if (plan.warm.length > 0) {
      const job = await prisma.warmupJob.create({
        data: {
          storeId: store.id,
          urls: plan.warm,
          total: plan.warm.length,
          status: "pending",
          source: type === "purge.all" ? "purge" : "event",
          eventId: created.id,
        },
      });
      warmupJobId = job.id;
    }

    if (countsAgainstPlan) {
      used += 1;
      counted += 1;
    }
    purgedTotal += plan.purge.length;

    results.push({
      ref,
      event_id: created.id,
      purge: plan.purge,
      warm: plan.warm,
      store_api: plan.store_api,
      warmup_job_id: warmupJobId,
      duration_ms: durationMs,
    });
  }

  const resetStats = incoming.some((e) => e.type === "purge.all");
  const day = utcDay(now);

  await Promise.all([
    prisma.store.update({
      where: { id: store.id },
      data: {
        lastEventAt: now,
        lastSeenAt: now,
        ...(counted ? { monthlyEvents: { increment: counted } } : {}),
        ...(resetStats ? { hitRate: 0 } : {}),
      },
    }),
    prisma.metric.upsert({
      where: { storeId_date: { storeId: store.id, date: day } },
      update: {
        eventsUsed: { increment: counted },
        purges: { increment: purgedTotal },
        ...(resetStats ? { hits: 0, misses: 0, bypasses: 0 } : {}),
      },
      create: { storeId: store.id, date: day, eventsUsed: counted, purges: purgedTotal },
    }),
  ]);

  const limited = results.length > 0 && results.every((r) => r.code === "EVENT_LIMIT");
  return NextResponse.json({ results }, { status: limited ? 429 : 200 });
}
