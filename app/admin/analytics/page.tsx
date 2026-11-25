import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { utcDay } from "@/lib/connector";
import { ONLINE_MS } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, Pill, Stat, Table, Td, ago } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export const metadata = { title: "Analytics" };

const DAY = 86_400_000;
const DAYS = 14;

const EVENT_LABEL: Record<string, string> = {
  "product.stock": "Stock change",
  "product.price": "Price change",
  "product.update": "Product edit",
  "product.sale": "Sale start or end",
  "order.status": "Order status",
  "order.stock": "Order stock",
  "order.refund": "Refund",
  "term.update": "Category or tag",
  "system.theme": "Theme or menu",
  "system.scan": "Catalog scan",
  "manual.purge": "Manual purge",
  "purge.all": "Purge all",
};

function label(type: string) {
  return EVENT_LABEL[type] ?? type;
}

function pct(part: number, whole: number) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const width = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full bg-white/[0.05]">
      <div className={`h-full ${className}`} style={{ width: `${width}%` }} />
    </div>
  );
}

export default async function AdminAnalytics() {
  const now = new Date();
  const today = utcDay(now);
  const start = new Date(today.getTime() - (DAYS - 1) * DAY);
  const since24 = new Date(now.getTime() - DAY);

  const [daily, todayByStore, eventMix, latest, online, totalStores, warm24, warmFailed24, newAccounts, storeNames, staleCount] = await Promise.all([
    prisma.metric.groupBy({
      by: ["date"],
      where: { date: { gte: start } },
      _sum: { hits: true, misses: true, bypasses: true },
    }),
    prisma.metric.groupBy({
      by: ["storeId"],
      where: { date: today },
      _sum: { hits: true, misses: true, bypasses: true },
    }),
    prisma.event.groupBy({
      by: ["type"],
      where: { createdAt: { gte: since24 } },
      _count: true,
      _avg: { durationMs: true },
    }),
    prisma.event.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.store.count({ where: { lastSeenAt: { gte: new Date(now.getTime() - ONLINE_MS) } } }),
    prisma.store.count(),
    prisma.warmupJob.count({ where: { createdAt: { gte: since24 }, status: { in: ["completed", "partial"] } } }),
    prisma.warmupJob.count({ where: { createdAt: { gte: since24 }, status: "failed" } }),
    prisma.user.count({ where: { createdAt: { gte: start } } }),
    prisma.store.findMany({ select: { id: true, name: true, url: true, user: { select: { email: true } }, lastSeenAt: true } }),
    prisma.store.count({ where: { lastSeenAt: { lt: new Date(now.getTime() - ONLINE_MS) } } }),
  ]);

  // Build a continuous 14-day series (zeros for days with no metric row).
  const series = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY);
    const row = daily.find((d) => d.date.getTime() === date.getTime());
    return {
      date,
      hits: row?._sum.hits ?? 0,
      misses: row?._sum.misses ?? 0,
      bypasses: row?._sum.bypasses ?? 0,
    };
  });
  const seriesMax = Math.max(1, ...series.map((d) => d.hits + d.misses + d.bypasses));

  const todayTotals = todayByStore.reduce(
    (acc, r) => ({
      hits: acc.hits + (r._sum.hits ?? 0),
      misses: acc.misses + (r._sum.misses ?? 0),
      bypasses: acc.bypasses + (r._sum.bypasses ?? 0),
    }),
    { hits: 0, misses: 0, bypasses: 0 },
  );
  const served = todayTotals.hits + todayTotals.misses;
  const requests = served + todayTotals.bypasses;

  const names = new Map(storeNames.map((s) => [s.id, s]));
  const topStores = [...todayByStore]
    .sort((a, b) => (b._sum.hits ?? 0) + (b._sum.misses ?? 0) - ((a._sum.hits ?? 0) + (a._sum.misses ?? 0)))
    .slice(0, 8);

  const mix = [...eventMix].sort((a, b) => b._count - a._count);
  const mixMax = Math.max(1, ...mix.map((m) => m._count));
  const eventTotal = mix.reduce((n, m) => n + m._count, 0);

  return (
    <div className="space-y-6">
      <PageHead title="Analytics" intro="Live traffic across every connected store. Traffic is counted by the connectors, in UTC.">
        <AutoRefresh intervalSeconds={30} />
      </PageHead>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Requests today" value={requests.toLocaleString("en-US")} hint={`${todayTotals.hits.toLocaleString("en-US")} served from cache`} />
        <Stat label="Cache hit rate today" value={pct(todayTotals.hits, served)} hint={`${todayTotals.misses.toLocaleString("en-US")} rendered by WooCommerce`} tone="mint" />
        <Stat label="Bypassed today" value={todayTotals.bypasses.toLocaleString("en-US")} hint="Carts, logins and sessions, never cached" />
        <Stat label="Stores online now" value={`${online}/${totalStores}`} hint={`${totalStores - online} offline or not installed`} tone={online < totalStores ? "amber" : "mint"} />
        <Stat label="Catalog events · 24h" value={eventTotal.toLocaleString("en-US")} hint={`${mix.length} kinds of change`} />
        <Stat label="Warmups · 24h" value={warm24.toLocaleString("en-US")} hint={warmFailed24 ? `${warmFailed24} failed` : "none failed"} tone={warmFailed24 ? "amber" : undefined} />
        <Stat label="New accounts · 14 days" value={newAccounts} />
        <Stat label="Stores not reporting" value={staleCount} hint="No heartbeat in the last 2.5 minutes" tone={staleCount ? "amber" : undefined} />
      </div>

      <Panel title="Requests per day · last 14 days" intro="Stacked: served from cache, rendered by WooCommerce, and bypassed (carts and logins).">
        <div className="flex h-56 items-end gap-1.5 px-4 pb-3 pt-6">
          {series.map((d) => {
            const total = d.hits + d.misses + d.bypasses;
            const scale = (v: number) => (seriesMax > 0 ? (v / seriesMax) * 100 : 0);
            const isToday = d.date.getTime() === today.getTime();
            return (
              <div key={d.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[11px] text-paper/45">{total ? total.toLocaleString("en-US") : ""}</span>
                <div className="flex w-full flex-col-reverse overflow-hidden" style={{ height: `${Math.max(2, scale(total)) * 1.6}px` }} title={`${d.date.toISOString().slice(0, 10)}: ${d.hits} cache, ${d.misses} origin, ${d.bypasses} bypass`}>
                  <div className="bg-mint/80" style={{ height: `${total ? (d.hits / total) * 100 : 0}%` }} />
                  <div className="bg-accent/80" style={{ height: `${total ? (d.misses / total) * 100 : 0}%` }} />
                  <div className="bg-white/25" style={{ height: `${total ? (d.bypasses / total) * 100 : 0}%` }} />
                </div>
                <span className={`text-[11px] ${isToday ? "text-paper" : "text-paper/40"}`}>
                  {d.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" })}
                </span>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-white/8 px-4 py-3 text-[13px] text-paper/55">
          <span className="flex items-center gap-2"><span className="h-2 w-2 bg-mint/80" />Cache</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 bg-accent/80" />WooCommerce</span>
          <span className="flex items-center gap-2"><span className="h-2 w-2 bg-white/25" />Bypass</span>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top stores today" intro="By requests served and rendered">
          {topStores.length === 0 ? (
            <Empty>No traffic reported yet today.</Empty>
          ) : (
            <Table head={["Store", "Cache", "Origin", "Hit rate"]} minWidth={460}>
              {topStores.map((r) => {
                const s = names.get(r.storeId);
                const h = r._sum.hits ?? 0;
                const m = r._sum.misses ?? 0;
                return (
                  <tr key={r.storeId}>
                    <Td>
                      <Link href={`/admin/stores/${r.storeId}`} className="text-paper hover:text-accent">{s?.name ?? "Store"}</Link>
                      <span className="block text-[12px] text-paper/45">{s?.user.email}</span>
                    </Td>
                    <Td mono>{h.toLocaleString("en-US")}</Td>
                    <Td mono dim>{m.toLocaleString("en-US")}</Td>
                    <Td mono>{pct(h, h + m)}</Td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Panel>

        <Panel title="What changed · last 24 hours" intro="Catalog events that Silo handled, by kind">
          {mix.length === 0 ? (
            <Empty>No catalog events in the last 24 hours.</Empty>
          ) : (
            <div className="space-y-3 p-4">
              {mix.map((m) => (
                <div key={m.type} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1">
                  <span className="text-[14px] text-paper/80">{label(m.type)}</span>
                  <span className="font-mono text-[13px] text-paper/60">
                    {m._count.toLocaleString("en-US")}
                    {m._avg.durationMs != null ? <span className="text-paper/35"> · {Math.round(m._avg.durationMs)} ms</span> : null}
                  </span>
                  <div className="col-span-2">
                    <Bar value={m._count} max={mixMax} className="bg-accent/80" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Live feed" intro="The 25 most recent catalog events across every store">
        {latest.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <Table head={["When", "Store", "Change", "Detail", "Purged", "Warmed"]} minWidth={860}>
            {latest.map((e) => (
              <tr key={e.id}>
                <Td dim className="whitespace-nowrap">{ago(e.createdAt)}</Td>
                <Td><Link href={`/admin/stores/${e.store.id}`} className="text-paper hover:text-accent">{e.store.name}</Link></Td>
                <Td>
                  {label(e.type)}
                  {e.counted === false ? <span className="ml-2"><Pill>not counted</Pill></span> : null}
                </Td>
                <Td dim className="max-w-[300px] truncate">{e.detail ?? e.object ?? "—"}</Td>
                <Td mono>{Array.isArray(e.purgeUrls) ? e.purgeUrls.length : 0}</Td>
                <Td mono>{Array.isArray(e.warmUrls) ? e.warmUrls.length : 0}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
