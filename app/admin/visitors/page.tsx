import { prisma } from "@/lib/prisma";
import { utcDay } from "@/lib/connector";
import { Empty, PageHead, Panel, Stat, Table, Td } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/admin/auto-refresh";

export const metadata = { title: "Visitors" };

const DAY = 86_400_000;
const DAYS = 14;

const COUNTRY: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia", DE: "Germany", FR: "France",
  NL: "Netherlands", IN: "India", BR: "Brazil", ES: "Spain", IT: "Italy", MX: "Mexico", SE: "Sweden",
  PL: "Poland", ZA: "South Africa", NG: "Nigeria", PH: "Philippines", IE: "Ireland", NZ: "New Zealand",
};

function pct(part: number, whole: number) {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}

export default async function AdminVisitors() {
  const now = new Date();
  const today = utcDay(now);
  const start = new Date(today.getTime() - (DAYS - 1) * DAY);
  const since30 = new Date(now.getTime() - 30 * DAY);

  const [daily, todayViews, todayVisitors, topPages, referrers, countries, signups30, paidNow, trialingNow, visitors30, views30, usersTotal] = await Promise.all([
    prisma.pageView.groupBy({ by: ["day"], where: { day: { gte: start } }, _count: { _all: true } }),
    prisma.pageView.count({ where: { day: today } }),
    prisma.pageView.groupBy({ by: ["visitor"], where: { day: today } }).then((r) => r.length),
    prisma.pageView.groupBy({ by: ["path"], where: { day: { gte: start } }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 }),
    prisma.pageView.groupBy({ by: ["referrer"], where: { day: { gte: start }, referrer: { not: null } }, _count: { _all: true }, orderBy: { _count: { referrer: "desc" } }, take: 10 }),
    prisma.pageView.groupBy({ by: ["country"], where: { day: { gte: start }, country: { not: null } }, _count: { _all: true }, orderBy: { _count: { country: "desc" } }, take: 10 }),
    prisma.user.count({ where: { createdAt: { gte: since30 } } }),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { status: "trialing" } }),
    prisma.pageView.findMany({ where: { day: { gte: since30 } }, select: { visitor: true }, distinct: ["visitor"] }).then((r) => r.length),
    prisma.pageView.count({ where: { day: { gte: since30 } } }),
    prisma.user.count(),
  ]);

  const series = Array.from({ length: DAYS }, (_, i) => {
    const date = new Date(start.getTime() + i * DAY);
    const row = daily.find((d) => d.day.getTime() === date.getTime());
    return { date, views: row?._count._all ?? 0 };
  });
  const max = Math.max(1, ...series.map((s) => s.views));
  const views14 = series.reduce((n, s) => n + s.views, 0);

  const funnel = [
    { label: "Visitors (30 days)", value: visitors30 },
    { label: "Sign-ups (30 days)", value: signups30 },
    { label: "Trialing now", value: trialingNow },
    { label: "Paying now", value: paidNow },
  ];

  return (
    <div className="space-y-6">
      <PageHead title="Visitors" intro="People on heysilo.co. Counted without cookies; visitors are unique per day only.">
        <AutoRefresh intervalSeconds={60} />
      </PageHead>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Page views today" value={todayViews.toLocaleString("en-US")} />
        <Stat label="Visitors today" value={todayVisitors.toLocaleString("en-US")} hint="Unique per day" />
        <Stat label="Page views · 14 days" value={views14.toLocaleString("en-US")} />
        <Stat label="Visitors · 30 days" value={visitors30.toLocaleString("en-US")} hint={`${views30.toLocaleString("en-US")} page views`} />
        <Stat label="Sign-up rate · 30 days" value={pct(signups30, visitors30)} hint="Sign-ups per visitor" tone="accent" />
        <Stat label="Trialing now" value={trialingNow} hint={`${usersTotal.toLocaleString("en-US")} accounts in total`} />
        <Stat label="Paying now" value={paidNow} tone="mint" />
        <Stat label="Trial to paid" value={pct(paidNow, paidNow + trialingNow)} hint="Of accounts on a plan or trial" />
      </div>

      <Panel title="Page views per day · last 14 days">
        <div className="flex h-48 items-end gap-1.5 px-4 pb-3 pt-6">
          {series.map((s) => (
            <div key={s.date.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
              <span className="font-mono text-[11px] text-paper/45">{s.views ? s.views : ""}</span>
              <div className="w-full bg-accent/75" style={{ height: `${Math.max(s.views ? 3 : 0, (s.views / max) * 140)}px` }} />
              <span className="text-[11px] text-paper/40">{s.date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", timeZone: "UTC" })}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sign-up funnel · 30 days" intro="Visitors to paying accounts">
          <div className="space-y-3 p-4">
            {funnel.map((step, i) => {
              const top = funnel[0].value || 1;
              return (
                <div key={step.label}>
                  <div className="flex justify-between text-[14px]">
                    <span className="text-paper/75">{step.label}</span>
                    <span className="font-mono text-paper/60">
                      {step.value.toLocaleString("en-US")}
                      {i > 0 ? <span className="text-paper/35"> · {pct(step.value, i === 1 ? visitors30 : funnel[i - 1].value)}</span> : null}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 bg-white/[0.05]">
                    <div className="h-full bg-mint/75" style={{ width: `${Math.max(step.value ? 2 : 0, (step.value / top) * 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Top pages · 14 days">
          {topPages.length === 0 ? (
            <Empty>No page views yet.</Empty>
          ) : (
            <Table head={["Page", "Views"]} minWidth={360}>
              {topPages.map((p) => (
                <tr key={p.path}>
                  <Td mono>{p.path}</Td>
                  <Td mono>{p._count._all.toLocaleString("en-US")}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Where visitors come from · 14 days" intro="Referring sites. Direct visits aren't listed.">
          {referrers.length === 0 ? (
            <Empty>No referrals yet.</Empty>
          ) : (
            <Table head={["Site", "Visits"]} minWidth={360}>
              {referrers.map((r) => (
                <tr key={r.referrer ?? "x"}>
                  <Td mono>{r.referrer}</Td>
                  <Td mono>{r._count._all.toLocaleString("en-US")}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>

        <Panel title="Countries · 14 days" intro="From the visitor's country, when the hosting provider reports it">
          {countries.length === 0 ? (
            <Empty>No country data yet.</Empty>
          ) : (
            <Table head={["Country", "Views"]} minWidth={360}>
              {countries.map((c) => (
                <tr key={c.country ?? "x"}>
                  <Td>{COUNTRY[c.country ?? ""] ?? c.country}</Td>
                  <Td mono>{c._count._all.toLocaleString("en-US")}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </div>
  );
}
