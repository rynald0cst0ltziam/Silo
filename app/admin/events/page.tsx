import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Empty, PageHead, Panel, Stat, Table, Td, ago } from "@/components/admin/ui";

export const metadata = { title: "Events" };

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "" } = await searchParams;
  const since = new Date(Date.now() - 86_400_000);
  const [events, byType, slow] = await Promise.all([
    prisma.event.findMany({
      where: type ? { type } : undefined,
      orderBy: { createdAt: "desc" },
      take: 150,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: true, _avg: { durationMs: true } }),
    prisma.event.count({ where: { createdAt: { gte: since }, durationMs: { gt: 500 } } }),
  ]);
  const total = byType.reduce((n, t) => n + t._count, 0);
  const avg = total ? Math.round(byType.reduce((n, t) => n + (t._avg.durationMs ?? 0) * t._count, 0) / total) : 0;

  return (
    <div className="space-y-6">
      <PageHead title="Events" intro="Catalog events from every connector, newest first." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Events · 24h" value={total.toLocaleString()} />
        <Stat label="Avg graph time" value={`${avg} ms`} hint="Silo-side invalidation planning" />
        <Stat label="Over 500 ms" value={slow} tone={slow ? "amber" : undefined} />
        <Stat label="Event types · 24h" value={byType.length} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link href="/admin/events" className={`border px-3 py-1.5 text-[13px] ${!type ? "border-accent/50 bg-accent/10 text-paper" : "border-white/10 text-paper/60"}`}>all</Link>
        {byType
          .sort((a, b) => b._count - a._count)
          .map((t) => (
            <Link key={t.type} href={`/admin/events?type=${encodeURIComponent(t.type)}`} className={`border px-3 py-1.5 font-mono text-[12px] ${type === t.type ? "border-accent/50 bg-accent/10 text-paper" : "border-white/10 text-paper/60 hover:text-paper"}`}>
              {t.type} <span className="text-paper/40">{t._count}</span>
            </Link>
          ))}
      </div>

      <Panel title={`${events.length} latest`}>
        {events.length === 0 ? (
          <Empty>No events.</Empty>
        ) : (
          <Table head={["When", "Store", "Type", "Object", "Purged", "Warmed", "Silo", "Store"]} minWidth={980}>
            {events.map((e) => (
              <tr key={e.id}>
                <Td dim>{ago(e.createdAt)}</Td>
                <Td><Link href={`/admin/stores/${e.store.id}`} className="text-paper hover:text-accent">{e.store.name}</Link></Td>
                <Td mono>{e.type}</Td>
                <Td className="max-w-[280px] truncate">{e.object ?? "—"}</Td>
                <Td mono>{Array.isArray(e.purgeUrls) ? e.purgeUrls.length : 0}</Td>
                <Td mono>{Array.isArray(e.warmUrls) ? e.warmUrls.length : 0}</Td>
                <Td mono dim>{e.durationMs != null ? `${e.durationMs} ms` : "—"}</Td>
                <Td mono dim>{e.localMs != null ? `${e.localMs} ms` : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
