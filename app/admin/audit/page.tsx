import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AUDIT_LABELS } from "@/lib/audit";
import { Empty, PageHead, Panel, Table, Td, UserLink } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

const GROUPS = ["all", "account", "billing", "store", "admin"] as const;

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ group?: string }> }) {
  const { group = "all" } = await searchParams;
  const entries = await prisma.auditLog.findMany({
    where: group !== "all" ? { action: { startsWith: `${group}.` } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const ids = [...new Set(entries.flatMap((e) => [e.userId, e.actorId]).filter((x): x is string => !!x))];
  const emails = new Map((await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]));

  return (
    <div className="space-y-6">
      <PageHead title="Audit log" intro="Sign-ins, billing changes, store actions and every admin action. Kept for 400 days." />

      <div className="flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <Link key={g} href={`/admin/audit${g === "all" ? "" : `?group=${g}`}`} className={`border px-3 py-1.5 text-[13px] ${group === g ? "border-accent/50 bg-accent/10 text-paper" : "border-white/10 text-paper/60 hover:text-paper"}`}>
            {g}
          </Link>
        ))}
      </div>

      <Panel title={`${entries.length} latest`}>
        {entries.length === 0 ? (
          <Empty>Nothing recorded.</Empty>
        ) : (
          <Table head={["When (UTC)", "Account", "What", "By", "Detail", "IP"]} minWidth={1000}>
            {entries.map((e) => {
              const email = e.userId ? emails.get(e.userId) : undefined;
              const actor = e.actorId && e.actorId !== e.userId ? emails.get(e.actorId) ?? "admin" : null;
              return (
                <tr key={e.id}>
                  <Td dim className="whitespace-nowrap">{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</Td>
                  <Td>{email && e.userId ? <UserLink id={e.userId} email={email} /> : <span className="text-paper/45">{e.target ?? "deleted account"}</span>}</Td>
                  <Td className={e.action.endsWith("failed") ? "text-amber" : ""}>{AUDIT_LABELS[e.action] ?? e.action}</Td>
                  <Td dim>{actor ?? "customer"}</Td>
                  <Td dim className="max-w-[300px] truncate">{e.detail ? JSON.stringify(e.detail) : e.target ?? "—"}</Td>
                  <Td mono dim>{e.ip ?? "—"}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>
    </div>
  );
}
