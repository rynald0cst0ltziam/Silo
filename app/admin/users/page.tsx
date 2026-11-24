import Link from "next/link";
import { loadUsers, money } from "@/lib/admin-metrics";
import { Empty, PageHead, Panel, StateBadge, Table, Td, UserLink, ago, day } from "@/components/admin/ui";

export const metadata = { title: "Users" };

const FILTERS = ["all", "trial", "active", "past_due", "comped", "expired", "canceled", "suspended"] as const;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; state?: string }> }) {
  const { q = "", state = "all" } = await searchParams;
  const all = await loadUsers();
  const needle = q.trim().toLowerCase();
  const users = all.filter(
    (u) => (state === "all" || u.state === state) && (!needle || u.email.includes(needle) || (u.name ?? "").toLowerCase().includes(needle) || u.id === needle),
  );

  return (
    <div className="space-y-6">
      <PageHead title="Users" intro={`${all.length} accounts`}>
        <form className="flex gap-2" action="/admin/users">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email, name or ID"
            className="h-10 w-64 border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none focus:border-accent/60"
          />
          {state !== "all" ? <input type="hidden" name="state" value={state} /> : null}
          <button className="h-10 bg-white/[0.08] px-4 text-[14px] text-paper hover:bg-white/[0.12]">Search</button>
        </form>
      </PageHead>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const count = f === "all" ? all.length : all.filter((u) => u.state === f).length;
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (f !== "all") params.set("state", f);
          return (
            <Link
              key={f}
              href={`/admin/users${params.size ? `?${params}` : ""}`}
              className={`border px-3 py-1.5 text-[13px] ${state === f ? "border-accent/50 bg-accent/10 text-paper" : "border-white/10 text-paper/60 hover:text-paper"}`}
            >
              {f.replace("_", " ")} <span className="font-mono text-paper/40">{count}</span>
            </Link>
          );
        })}
      </div>

      <Panel title={`${users.length} shown`}>
        {users.length === 0 ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <Table head={["Account", "State", "Plan", "Stores", "Events (month)", "MRR", "Joined", "Last sign-in"]} minWidth={980}>
            {users.map((u) => (
              <tr key={u.id}>
                <Td>
                  <UserLink id={u.id} email={u.email} />
                  {u.name ? <span className="block text-[13px] text-paper/45">{u.name}</span> : null}
                  {u.role === "admin" ? <span className="mt-1 inline-block font-mono text-[11px] uppercase text-amber">admin</span> : null}
                </Td>
                <Td>
                  <StateBadge state={u.state} />
                  {u.state === "trial" ? <span className="block pt-1 text-[12px] text-paper/45">{u.trialDaysLeft}d left</span> : null}
                </Td>
                <Td>{u.plan ? u.tierName : "—"}</Td>
                <Td mono>{u.stores}</Td>
                <Td mono>{u.eventsMonth.toLocaleString()}</Td>
                <Td mono>{u.mrr ? money(u.mrr) : "—"}</Td>
                <Td dim>{day(u.createdAt)}</Td>
                <Td dim>{ago(u.lastLoginAt)}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Panel>
    </div>
  );
}
