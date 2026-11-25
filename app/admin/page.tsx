import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { loadOverview, money } from "@/lib/admin-metrics";
import { AUDIT_LABELS } from "@/lib/audit";
import { Empty, PageHead, Panel, Stat, StateBadge, Table, Td, UserLink, ago, day } from "@/components/admin/ui";

export const metadata = { title: "Overview" };

const CRON_JOBS: Array<{ name: string; everyMs: number }> = [
  { name: "warmup", everyMs: 5 * 60_000 },
  { name: "trial-emails", everyMs: 3_600_000 },
  { name: "cleanup", everyMs: 24 * 3_600_000 },
  { name: "daily-warmup", everyMs: 24 * 3_600_000 },
  { name: "reset-events", everyMs: 31 * 24 * 3_600_000 },
];

export default async function AdminOverview() {
  const [o, audit, cron] = await Promise.all([
    loadOverview(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    Promise.all(CRON_JOBS.map((j) => prisma.cronRun.findFirst({ where: { name: j.name }, orderBy: { createdAt: "desc" } }))),
  ]);
  const emails = new Map(
    (await prisma.user.findMany({ where: { id: { in: audit.map((a) => a.userId).filter((x): x is string => !!x) } }, select: { id: true, email: true } })).map((u) => [u.id, u.email]),
  );
  const paying = (o.byState.active ?? 0) + (o.byState.past_due ?? 0);

  return (
    <div className="space-y-6">
      <PageHead title="Overview" intro={`Live numbers across every Silo account · ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={money(o.mrr)} hint={`ARR ${money(o.arr)}`} tone="mint" />
        <Stat label="Revenue · 30 days" value={money(o.revenue30)} hint={`${o.invoices30} paid invoice${o.invoices30 === 1 ? "" : "s"}`} />
        <Stat label="Paying accounts" value={paying} hint={`${o.byState.past_due ?? 0} past due · ${o.canceling} canceling`} tone={o.byState.past_due ? "amber" : undefined} />
        <Stat label="Pipeline" value={money(o.pipeline)} hint={`${o.trialingSubs} card-on-file trial${o.trialingSubs === 1 ? "" : "s"} converting`} tone="accent" />
        <Stat label="Accounts" value={o.users} hint={`+${o.newUsers7} this week · +${o.newUsers30} in 30 days`} />
        <Stat label="Free trials" value={o.byState.trial ?? 0} hint={`${o.byState.expired ?? 0} expired · ${o.byState.canceled ?? 0} ended · ${o.byState.comped ?? 0} comped`} />
        <Stat label="Stores online" value={`${o.online}/${o.stores}`} hint={`${o.coexist} working alongside another cache`} tone={o.stores && o.online < o.stores ? "amber" : "mint"} />
        <Stat label="Events" value={o.eventsToday.toLocaleString()} hint={`today · ${o.eventsMonth.toLocaleString()} this month · ${o.warm24} warmups 24h`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Plans" intro="Active and past-due subscriptions">
          <Table head={["Plan", "Subscriptions", "Annual", "MRR"]} minWidth={420}>
            {o.byTier.map((t) => (
              <tr key={t.tier}>
                <Td>{t.tier}</Td>
                <Td mono>{t.count}</Td>
                <Td mono dim>{t.annual}</Td>
                <Td mono>{money(t.mrr)}</Td>
              </tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Scheduled jobs" intro="Vercel Cron runs recorded by Silo" action={<Link href="/admin/system" className="text-[13px] text-accent hover:underline">System</Link>}>
          <Table head={["Job", "Last run", "Result", "Took"]} minWidth={420}>
            {CRON_JOBS.map((job, i) => {
              const run = cron[i];
              const late = !run || Date.now() - run.createdAt.getTime() > job.everyMs * 2.5;
              return (
                <tr key={job.name}>
                  <Td mono>{job.name}</Td>
                  <Td dim>{run ? ago(run.createdAt) : "never"}</Td>
                  <Td>{!run ? <span className="text-paper/45">no runs yet</span> : !run.ok ? <span className="text-red-300">failed</span> : late ? <span className="text-amber">overdue</span> : <span className="text-mint">ok</span>}</Td>
                  <Td mono dim>{run ? `${run.ms} ms` : "—"}</Td>
                </tr>
              );
            })}
          </Table>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Newest accounts" action={<Link href="/admin/users" className="text-[13px] text-accent hover:underline">All users</Link>}>
          {o.recentUsers.length === 0 ? (
            <Empty>No accounts yet.</Empty>
          ) : (
            <Table head={["Account", "State", "Stores", "Joined"]} minWidth={460}>
              {o.recentUsers.map((u) => (
                <tr key={u.id}>
                  <Td><UserLink id={u.id} email={u.email} /></Td>
                  <Td><StateBadge state={u.state} /></Td>
                  <Td mono>{u.stores}</Td>
                  <Td dim>{day(u.createdAt)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Connector versions" intro="Stores per installed connector version">
          {o.versions.length === 0 ? (
            <Empty>No stores yet.</Empty>
          ) : (
            <Table head={["Version", "Stores"]} minWidth={300}>
              {o.versions.map((v) => (
                <tr key={v.version}>
                  <Td mono>{v.version}</Td>
                  <Td mono>{v.count}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <Panel title="Latest account activity" action={<Link href="/admin/audit" className="text-[13px] text-accent hover:underline">Audit log</Link>}>
        {audit.length === 0 ? (
          <Empty>Nothing recorded yet.</Empty>
        ) : (
          <Table head={["When", "Account", "What", "Detail"]}>
            {audit.map((a) => (
              <tr key={a.id}>
                <Td dim>{ago(a.createdAt)}</Td>
                <Td>{a.userId && emails.get(a.userId) ? <UserLink id={a.userId} email={emails.get(a.userId)!} /> : <span className="text-paper/45">{a.target ?? "deleted account"}</span>}</Td>
                <Td>{AUDIT_LABELS[a.action] ?? a.action}</Td>
                <Td dim className="max-w-[320px] truncate">{a.target ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
