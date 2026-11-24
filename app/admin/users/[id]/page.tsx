import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin";
import { getAccess, activeStoreIds } from "@/lib/entitlements";
import { AUDIT_LABELS } from "@/lib/audit";
import { money, monthlyValue, ONLINE_MS } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, Pill, StateBadge, Table, Td, ago, day } from "@/components/admin/ui";
import { UserActions } from "@/components/admin/user-actions";

export const metadata = { title: "Account" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-4 py-2.5 last:border-0">
      <span className="text-[13px] text-paper/50">{label}</span>
      <span className="text-right text-[14px] text-paper/85">{children}</span>
    </div>
  );
}

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage();
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      stores: { orderBy: { createdAt: "asc" } },
      invoices: { orderBy: { createdAt: "desc" }, take: 24 },
    },
  });
  if (!user) notFound();

  const access = getAccess(user);
  const [allowed, log] = await Promise.all([
    access.active ? activeStoreIds(user.id, access.tier) : Promise.resolve(new Set<string>()),
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const sub = user.subscription;
  const paid = user.invoices.filter((i) => i.status === "paid").reduce((n, i) => n + i.amountPaid, 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/users" className="text-[13px] text-paper/50 hover:text-paper">← Users</Link>
        <PageHead title={user.email} intro={`${user.name ? `${user.name} · ` : ""}joined ${day(user.createdAt)} · last sign-in ${ago(user.lastLoginAt)}`}>
          <div className="flex items-center gap-2">
            <StateBadge state={access.state} />
            {user.role === "admin" ? <Pill tone="amber">admin</Pill> : null}
          </div>
        </PageHead>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Panel title="Access">
          <Row label="State">{access.message}</Row>
          <Row label="Limits">{access.tier.name}: {access.tier.maxStores} stores · {access.tier.maxMonthlyEvents.toLocaleString()} events/mo</Row>
          <Row label="Trial ends">{day(access.trialEndsAt)}{user.trialEndsAt ? " (set by admin)" : ""}</Row>
          <Row label="Complimentary plan">{user.planOverride ?? "—"}</Row>
          <Row label="Suspended">{user.suspendedAt ? `${day(user.suspendedAt)}${user.suspendedReason ? ` · ${user.suspendedReason}` : ""}` : "No"}</Row>
          <Row label="Account ID"><span className="font-mono text-[12px]">{user.id}</span></Row>
        </Panel>

        <Panel title="Billing">
          <Row label="Stripe customer">
            {user.stripeCustomerId ? (
              <a href={`https://dashboard.stripe.com/customers/${user.stripeCustomerId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[12px] text-accent hover:underline">
                {user.stripeCustomerId} <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              "—"
            )}
          </Row>
          <Row label="Subscription">{sub ? `${sub.tier} · ${sub.billingInterval === "year" ? "annual" : "monthly"} · ${sub.status}${sub.cancelAtPeriodEnd ? " · cancels at period end" : ""}` : "None"}</Row>
          <Row label="MRR">{sub && (sub.status === "active" || sub.status === "past_due") ? money(monthlyValue(sub)) : "—"}</Row>
          <Row label="Current period ends">{sub ? day(sub.currentPeriodEnd) : "—"}</Row>
          <Row label="Lifetime paid">{money(paid, user.invoices[0]?.currency ?? "usd", 2)}</Row>
        </Panel>
      </div>

      <Panel title="Actions" intro="Each action is recorded in this account's activity log.">
        <UserActions
          id={user.id}
          email={user.email}
          self={admin.id === user.id}
          role={user.role}
          suspended={!!user.suspendedAt}
          planOverride={user.planOverride}
          state={access.state}
        />
      </Panel>

      <Panel title={`Stores (${user.stores.length})`}>
        {user.stores.length === 0 ? (
          <Empty>No stores.</Empty>
        ) : (
          <Table head={["Store", "Status", "Connector", "Events (month)", "Last seen"]}>
            {user.stores.map((s) => {
              const online = !!s.lastSeenAt && Date.now() - s.lastSeenAt.getTime() < ONLINE_MS;
              return (
                <tr key={s.id}>
                  <Td>
                    <Link href={`/admin/stores/${s.id}`} className="text-paper hover:text-accent">{s.name}</Link>
                    <span className="block font-mono text-[12px] text-paper/45">{s.url}</span>
                  </Td>
                  <Td>
                    {!allowed.has(s.id) ? <Pill tone="rose">paused</Pill> : online ? <Pill tone="mint">online</Pill> : <Pill>{s.status}</Pill>}
                  </Td>
                  <Td mono dim>{s.connectorVersion ?? "—"}</Td>
                  <Td mono>{s.monthlyEvents.toLocaleString()}</Td>
                  <Td dim>{ago(s.lastSeenAt)}</Td>
                </tr>
              );
            })}
          </Table>
        )}
      </Panel>

      <Panel title="Invoices">
        {user.invoices.length === 0 ? (
          <Empty>No invoices.</Empty>
        ) : (
          <Table head={["Date", "Number", "Amount", "Status", ""]} minWidth={560}>
            {user.invoices.map((i) => (
              <tr key={i.id}>
                <Td dim>{day(i.createdAt)}</Td>
                <Td mono>{i.number ?? "—"}</Td>
                <Td mono>{money(i.status === "paid" ? i.amountPaid : i.amountDue, i.currency, 2)}</Td>
                <Td>{i.status}</Td>
                <Td>{i.hostedUrl ? <a href={i.hostedUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">View</a> : null}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Activity">
        {log.length === 0 ? (
          <Empty>Nothing recorded.</Empty>
        ) : (
          <Table head={["When", "What", "Detail", "By", "IP"]}>
            {log.map((e) => (
              <tr key={e.id}>
                <Td dim>{e.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })}</Td>
                <Td>{AUDIT_LABELS[e.action] ?? e.action}</Td>
                <Td dim className="max-w-[280px] truncate">{e.detail ? JSON.stringify(e.detail) : e.target ?? "—"}</Td>
                <Td dim>{e.actorId && e.actorId !== e.userId ? "admin" : "customer"}</Td>
                <Td mono dim>{e.ip ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
