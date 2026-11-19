import { prisma } from "@/lib/prisma";
import type { TierConfig } from "@/lib/tiers";
import type { ConnectorStats } from "@/lib/connector";

export type WarmResult = { url: string; status: string; code?: number; ms?: number; cache?: string; error?: string };

export type LiveWarmJob = {
  id: string;
  status: string;
  source: string;
  progress: number;
  failed: number;
  total: number;
  urls: string[];
  results: WarmResult[];
  eventId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type LiveEvent = {
  id: string;
  type: string;
  object: string | null;
  detail: string | null;
  purgeUrls: string[];
  warmUrls: string[];
  durationMs: number | null;
  localMs: number | null;
  counted: boolean;
  createdAt: string;
  state: "purged" | "queued" | "warming" | "warm" | "partial" | "failed" | "done";
  warm: { done: number; total: number; failed: number } | null;
  payload: Record<string, unknown> | null;
};

export type StoreLive = {
  store: {
    id: string;
    name: string;
    url: string;
    status: string;
    hitRate: number;
    monthlyEvents: number;
    lastSeenAt: string | null;
    lastEventAt: string | null;
    lastScanAt: string | null;
    configVersion: number;
    connectorVersion: string | null;
  };
  tier: { slug: string; name: string; maxMonthlyEvents: number; warmupUrlsPerEvent: number };
  online: boolean;
  seenAgo: number | null;
  stats: (ConnectorStats & { warmup?: Record<string, number> | null; events_queued?: number; received_at?: string }) | null;
  env: Record<string, unknown> | null;
  scan: Record<string, unknown> | null;
  today: { hits: number; misses: number; bypasses: number; warms: number; purges: number; eventsUsed: number };
  kpis: { invalidations24h: number; purged24h: number; warmed24h: number; avgDurationMs: number };
  chart: Array<{ date: string; hits: number; misses: number; bypasses: number; hitRate: number }>;
  events: LiveEvent[];
  warmup: { active: LiveWarmJob[]; recent: LiveWarmJob[] };
  catalog: {
    products: number;
    variations: number;
    archives: number;
    routes: number;
    nodes: number;
    edges: number;
    types: Record<string, number>;
  } | null;
  serverTime: string;
};

const ONLINE_MS = 150_000;

function warmJob(j: {
  id: string;
  status: string;
  source: string;
  progress: number;
  failed: number;
  total: number;
  urls: unknown;
  results: unknown;
  eventId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): LiveWarmJob {
  return {
    id: j.id,
    status: j.status,
    source: j.source,
    progress: j.progress,
    failed: j.failed,
    total: j.total,
    urls: Array.isArray(j.urls) ? (j.urls as string[]) : [],
    results: Array.isArray(j.results) ? (j.results as WarmResult[]) : [],
    eventId: j.eventId,
    createdAt: j.createdAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
  };
}

export async function getStoreLive(storeId: string, tier: TierConfig, opts: { events?: number } = {}): Promise<StoreLive | null> {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return null;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const chartFrom = new Date();
  chartFrom.setUTCDate(chartFrom.getUTCDate() - 29);
  chartFrom.setUTCHours(0, 0, 0, 0);

  const [events, metrics, jobs, dayAgg] = await Promise.all([
    prisma.event.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: opts.events ?? 25 }),
    prisma.metric.findMany({ where: { storeId, date: { gte: chartFrom } }, orderBy: { date: "asc" } }),
    prisma.warmupJob.findMany({ where: { storeId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.event.aggregate({
      where: { storeId, createdAt: { gte: since }, counted: true },
      _count: { _all: true },
      _avg: { durationMs: true },
    }),
  ]);

  const jobsByEvent = new Map(jobs.filter((j) => j.eventId).map((j) => [j.eventId!, j]));
  const missing = events.filter((e) => !jobsByEvent.has(e.id)).map((e) => e.id);
  if (missing.length) {
    const extra = await prisma.warmupJob.findMany({ where: { storeId, eventId: { in: missing } } });
    extra.forEach((j) => jobsByEvent.set(j.eventId!, j));
  }

  const liveEvents: LiveEvent[] = events.map((e) => {
    const job = jobsByEvent.get(e.id);
    const purgeUrls = Array.isArray(e.purgeUrls) ? (e.purgeUrls as string[]) : [];
    const warmUrls = Array.isArray(e.warmUrls) ? (e.warmUrls as string[]) : [];
    let state: LiveEvent["state"] = e.type.startsWith("system.") ? "done" : "purged";
    if (job) {
      state =
        job.status === "pending" ? "queued" : job.status === "running" ? "warming" : job.status === "completed" ? "warm" : job.status === "partial" ? "partial" : "failed";
    }
    return {
      id: e.id,
      type: e.type,
      object: e.object,
      detail: e.detail,
      purgeUrls,
      warmUrls,
      durationMs: e.durationMs,
      localMs: e.localMs,
      counted: e.counted,
      createdAt: e.createdAt.toISOString(),
      state,
      warm: job ? { done: job.progress, total: job.total, failed: job.failed } : null,
      payload: (e.payload as Record<string, unknown> | null) ?? null,
    };
  });

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayMetric = metrics.find((m) => m.date.toISOString().slice(0, 10) === todayKey);
  const last24 = events.filter((e) => e.createdAt >= since);

  const profile = store.profile as Record<string, unknown> | null;
  const graph = (profile?.graph as { nodes?: number; edges?: number } | undefined) ?? {};
  const seenAgo = store.lastSeenAt ? Date.now() - store.lastSeenAt.getTime() : null;

  return {
    store: {
      id: store.id,
      name: store.name,
      url: store.url,
      status: store.status,
      hitRate: store.hitRate,
      monthlyEvents: store.monthlyEvents,
      lastSeenAt: store.lastSeenAt?.toISOString() ?? null,
      lastEventAt: store.lastEventAt?.toISOString() ?? null,
      lastScanAt: store.lastScanAt?.toISOString() ?? null,
      configVersion: store.configVersion,
      connectorVersion: store.connectorVersion,
    },
    tier: { slug: tier.slug, name: tier.name, maxMonthlyEvents: tier.maxMonthlyEvents, warmupUrlsPerEvent: tier.warmupUrlsPerEvent },
    online: seenAgo !== null && seenAgo < ONLINE_MS,
    seenAgo: seenAgo === null ? null : Math.round(seenAgo / 1000),
    stats: (store.stats as StoreLive["stats"]) ?? null,
    env: (store.connectorEnv as Record<string, unknown> | null) ?? null,
    scan: (store.scanState as Record<string, unknown> | null) ?? null,
    today: {
      hits: todayMetric?.hits ?? 0,
      misses: todayMetric?.misses ?? 0,
      bypasses: todayMetric?.bypasses ?? 0,
      warms: todayMetric?.warms ?? 0,
      purges: todayMetric?.purges ?? 0,
      eventsUsed: todayMetric?.eventsUsed ?? 0,
    },
    kpis: {
      invalidations24h: dayAgg._count._all,
      purged24h: last24.reduce((s, e) => s + (Array.isArray(e.purgeUrls) ? (e.purgeUrls as unknown[]).length : 0), 0),
      warmed24h: jobs.filter((j) => j.createdAt >= since).reduce((s, j) => s + j.progress, 0),
      avgDurationMs: Math.round(dayAgg._avg.durationMs ?? 0),
    },
    chart: metrics.map((m) => ({
      date: m.date.toISOString().slice(0, 10),
      hits: m.hits,
      misses: m.misses,
      bypasses: m.bypasses,
      hitRate: m.hits + m.misses > 0 ? (m.hits / (m.hits + m.misses)) * 100 : 0,
    })),
    events: liveEvents,
    warmup: {
      active: jobs.filter((j) => j.status === "pending" || j.status === "running").map(warmJob),
      recent: jobs.filter((j) => j.status !== "pending" && j.status !== "running").slice(0, 12).map(warmJob),
    },
    catalog: profile
      ? {
          products: Number(profile.product_count ?? 0),
          variations: Number(profile.variation_count ?? 0),
          archives: Number(profile.archive_count ?? 0),
          routes: Array.isArray(profile.store_api_routes) ? (profile.store_api_routes as unknown[]).length : 0,
          nodes: Number(graph.nodes ?? 0),
          edges: Number(graph.edges ?? 0),
          types: (profile.product_types as Record<string, number>) ?? {},
        }
      : null,
    serverTime: new Date().toISOString(),
  };
}
