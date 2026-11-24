import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ONLINE_MS } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, Pill, Table, Td, UserLink, ago } from "@/components/admin/ui";

export const metadata = { title: "Stores" };

type Env = { cache_mode?: string; owner?: string; auth_error?: string; wc?: string; wp?: string };
type Stats = { hit_rate?: number; cached_pages?: number };

export default async function AdminStores({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string }> }) {
  const { q = "", filter = "all" } = await searchParams;
  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      lastSeenAt: true,
      monthlyEvents: true,
      connectorVersion: true,
      connectorEnv: true,
      stats: true,
      hitRate: true,
      user: { select: { id: true, email: true } },
    },
  });
  const now = Date.now();
  const needle = q.trim().toLowerCase();
  const rows = stores.filter((s) => {
    const online = !!s.lastSeenAt && now - s.lastSeenAt.getTime() < ONLINE_MS;
    const env = (s.connectorEnv ?? {}) as Env;
    if (filter === "online" && !online) return false;
    if (filter === "offline" && online) return false;
    if (filter === "coexist" && env.cache_mode !== "coexist") return false;
    if (filter === "errors" && !env.auth_error) return false;
    return !needle || s.name.toLowerCase().includes(needle) || s.url.toLowerCase().includes(needle) || s.user.email.includes(needle);
  });

  return (
    <div className="space-y-6">
      <PageHead title="Stores" intro={`${stores.length} connected stores across all accounts`}>
        <form className="flex gap-2" action="/admin/stores">
          <input name="q" defaultValue={q} placeholder="Search store, URL or owner" className="h-10 w-64 border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none focus:border-accent/60" />
          <button className="h-10 bg-white/[0.08] px-4 text-[14px] text-paper hover:bg-white/[0.12]">Search</button>
        </form>
      </PageHead>

      <div className="flex flex-wrap gap-1.5">
        {["all", "online", "offline", "coexist", "errors"].map((f) => (
          <Link key={f} href={`/admin/stores${f === "all" ? "" : `?filter=${f}`}`} className={`border px-3 py-1.5 text-[13px] ${filter === f ? "border-accent/50 bg-accent/10 text-paper" : "border-white/10 text-paper/60 hover:text-paper"}`}>
            {f === "coexist" ? "working alongside" : f === "errors" ? "connector errors" : f}
          </Link>
        ))}
      </div>

      <Panel title={`${rows.length} shown`}>
        {rows.length === 0 ? (
          <Empty>No stores match.</Empty>
        ) : (
          <Table head={["Store", "Owner", "State", "Serving", "Hit rate", "Events (month)", "Connector", "Last seen"]} minWidth={1080}>
            {rows.map((s) => {
              const online = !!s.lastSeenAt && now - s.lastSeenAt.getTime() < ONLINE_MS;
              const env = (s.connectorEnv ?? {}) as Env;
              const stats = (s.stats ?? {}) as Stats;
              return (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/admin/stores/${s.id}`} className="text-paper hover:text-accent">{s.name}</Link>
                    <span className="block font-mono text-[12px] text-paper/45">{s.url}</span>
                  </Td>
                  <Td><UserLink id={s.user.id} email={s.user.email} /></Td>
                  <Td>{env.auth_error ? <Pill tone="rose">paused</Pill> : online ? <Pill tone="mint">online</Pill> : s.lastSeenAt ? <Pill tone="amber">offline</Pill> : <Pill>not installed</Pill>}</Td>
                  <Td dim>{env.cache_mode === "coexist" ? `alongside ${env.owner || "other cache"}` : env.cache_mode ? "Silo" : "—"}</Td>
                  <Td mono>{env.cache_mode === "coexist" ? "—" : `${Number(stats.hit_rate ?? s.hitRate * 100).toFixed(1)}%`}</Td>
                  <Td mono>{s.monthlyEvents.toLocaleString()}</Td>
                  <Td mono dim>{s.connectorVersion ?? "—"}</Td>
                  <Td dim>{ago(s.lastSeenAt)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </div>
  );
}
