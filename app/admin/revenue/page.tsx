import { prisma } from "@/lib/prisma";
import { loadOverview, money } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, Stat, Table, Td, UserLink, day } from "@/components/admin/ui";

export const metadata = { title: "Revenue" };

export default async function AdminRevenue() {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 11, 1);
  since.setUTCHours(0, 0, 0, 0);

  const [o, paid, recent, openInvoices] = await Promise.all([
    loadOverview(),
    prisma.invoice.findMany({ where: { status: "paid", createdAt: { gte: since } }, select: { amountPaid: true, createdAt: true, currency: true } }),
    prisma.invoice.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { user: { select: { id: true, email: true } } } }),
    prisma.invoice.aggregate({ where: { status: "open" }, _sum: { amountDue: true }, _count: true }),
  ]);

  const months: Array<{ key: string; label: string; total: number; count: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(since);
    d.setUTCMonth(since.getUTCMonth() + i);
    months.push({ key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`, label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" }), total: 0, count: 0 });
  }
  for (const inv of paid) {
    const m = months.find((x) => x.key === `${inv.createdAt.getUTCFullYear()}-${inv.createdAt.getUTCMonth()}`);
    if (m) {
      m.total += inv.amountPaid;
      m.count += 1;
    }
  }
  const peak = Math.max(1, ...months.map((m) => m.total));
  const ytd = months.reduce((n, m) => n + m.total, 0);

  return (
    <div className="space-y-6">
      <PageHead title="Revenue" intro="From Stripe invoices and subscriptions mirrored by the webhook. Amounts in invoice currency (USD unless configured otherwise)." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="MRR" value={money(o.mrr)} hint={`ARR ${money(o.arr)}`} tone="mint" />
        <Stat label="Collected · 12 months" value={money(ytd)} hint={`${paid.length} paid invoices`} />
        <Stat label="Collected · 30 days" value={money(o.revenue30)} />
        <Stat label="Outstanding" value={money(openInvoices._sum.amountDue ?? 0)} hint={`${openInvoices._count} open invoice${openInvoices._count === 1 ? "" : "s"}`} tone={openInvoices._count ? "amber" : undefined} />
      </div>

      <Panel title="Collected per month">
        <div className="flex h-56 items-end gap-2 px-4 pb-3 pt-6">
          {months.map((m) => (
            <div key={m.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[11px] text-paper/50">{m.total ? money(m.total) : ""}</span>
              <div className="w-full bg-accent/70" style={{ height: `${Math.max(2, (m.total / peak) * 150)}px` }} title={`${m.label}: ${money(m.total, "usd", 2)} from ${m.count} invoices`} />
              <span className="text-[11px] text-paper/45">{m.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Subscriptions by plan">
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

      <Panel title="Latest invoices">
        {recent.length === 0 ? (
          <Empty>No invoices yet. They appear when Stripe issues them (webhook events invoice.*).</Empty>
        ) : (
          <Table head={["Date", "Account", "Number", "Amount", "Status", ""]}>
            {recent.map((i) => (
              <tr key={i.id}>
                <Td dim>{day(i.createdAt)}</Td>
                <Td><UserLink id={i.user.id} email={i.user.email} /></Td>
                <Td mono>{i.number ?? "—"}</Td>
                <Td mono>{money(i.status === "paid" ? i.amountPaid : i.amountDue, i.currency, 2)}</Td>
                <Td className={i.status === "paid" ? "text-mint" : i.status === "open" ? "text-amber" : "text-paper/50"}>{i.status}</Td>
                <Td>{i.hostedUrl ? <a href={i.hostedUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View</a> : null}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
