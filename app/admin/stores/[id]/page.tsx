import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getStoreAccess } from "@/lib/entitlements";
import { ONLINE_MS } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, Pill, Table, Td, UserLink, ago, day } from "@/components/admin/ui";
import { AdminStoreActions } from "@/components/admin/store-actions";

export const metadata = { title: "Store" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5 last:border-0">
      <span className="text-[13px] text-paper/50">{label}</span>
      <span className="text-right text-[14px] text-paper/85">{children}</span>
    </div>
  );
}

type Env = Record<string, unknown> & { cache_mode?: string; owner?: string; edge?: string[]; conflicts?: string[]; auth_error?: string; mode?: string; dropin?: string };

export default async function AdminStore({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!store) notFound();

  const [access, events, jobs] = await Promise.all([
    getStoreAccess(store.id, store.userId),
    prisma.event.findMany({ where: { storeId: id }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.warmupJob.findMany({ where: { storeId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const env = (store.connectorEnv ?? {}) as Env;
  const stats = (store.stats ?? {}) as Record<string, number>;
  const profile = (store.profile ?? {}) as Record<string, unknown>;
  const online = !!store.lastSeenAt && Date.now() - store.lastSeenAt.getTime() < ONLINE_MS;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/stores" className="text-[13px] text-paper/50 hover:text-paper">← Stores</Link>
        <PageHead title={store.name} intro={store.url}>
          <AdminStoreActions id={store.id} />
        </PageHead>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Connection">
          <Row label="Owner"><UserLink id={store.user.id} email={store.user.email} /></Row>
          <Row label="State">{online ? <Pill tone="mint">online</Pill> : <Pill tone="amber">last seen {ago(store.lastSeenAt)}</Pill>}</Row>
          <Row label="Plan access">{access?.storeActive ? "Active" : access?.storeMessage ?? "—"}</Row>
          <Row label="Connector">{store.connectorVersion ?? "not installed"}</Row>
          <Row label="Serving">{env.cache_mode === "coexist" ? `Working alongside ${env.owner || "another cache"}` : env.cache_mode === "silo" ? `Silo (${env.mode === "dropin" ? "drop-in" : "late serve"})` : "—"}</Row>
          <Row label="Edge layers purged">{env.edge?.length ? env.edge.join(", ") : "—"}</Row>
          <Row label="Connector error">{env.auth_error ? <span className="text-red-300">{env.auth_error}</span> : "None"}</Row>
          <Row label="Added">{day(store.createdAt)}</Row>
        </Panel>

        <Panel title="Cache and catalog">
          <Row label="Hit rate">{Number(stats.hit_rate ?? store.hitRate * 100).toFixed(1)}% · {(stats.hits ?? 0).toLocaleString()} hits / {(stats.misses ?? 0).toLocaleString()} misses</Row>
          <Row label="Cached pages">{(stats.cached_pages ?? 0).toLocaleString()} · Store API entries {(stats.api_entries ?? 0).toLocaleString()}</Row>
          <Row label="Events this month">{store.monthlyEvents.toLocaleString()}</Row>
          <Row label="Products">{Number(profile.product_count ?? 0).toLocaleString()} · variations {Number(profile.variation_count ?? 0).toLocaleString()}</Row>
          <Row label="Last scan">{day(store.lastScanAt)}</Row>
          <Row label="Config version">{store.configVersion}</Row>
          <Row label="Versions">{["wp", "wc", "php"].map((k) => `${k.toUpperCase()} ${String((env as Record<string, unknown>)[k] ?? "?")}`).join(" · ")}</Row>
        </Panel>
      </div>

      <Panel title="Recent events">
        {events.length === 0 ? (
          <Empty>No events yet.</Empty>
        ) : (
          <Table head={["When", "Type", "Object", "Purged", "Warmed", "Took"]}>
            {events.map((e) => (
              <tr key={e.id}>
                <Td dim>{ago(e.createdAt)}</Td>
                <Td mono>{e.type}</Td>
                <Td className="max-w-[280px] truncate">{e.object ?? "—"}{e.detail ? <span className="block text-[12px] text-paper/45">{e.detail}</span> : null}</Td>
                <Td mono>{Array.isArray(e.purgeUrls) ? e.purgeUrls.length : 0}</Td>
                <Td mono>{Array.isArray(e.warmUrls) ? e.warmUrls.length : 0}</Td>
                <Td mono dim>{e.durationMs != null ? `${e.durationMs} ms` : "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Warmup jobs">
        {jobs.length === 0 ? (
          <Empty>No warmup jobs.</Empty>
        ) : (
          <Table head={["When", "Source", "Status", "Progress", "Failed"]} minWidth={560}>
            {jobs.map((j) => (
              <tr key={j.id}>
                <Td dim>{ago(j.createdAt)}</Td>
                <Td>{j.source}</Td>
                <Td>{j.status}</Td>
                <Td mono>{j.progress}/{j.total}</Td>
                <Td mono>{j.failed}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
