import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUDIT_LABELS } from "@/lib/audit";

export const metadata: Metadata = {
  title: "Activity",
  robots: { index: false, follow: false },
};

function when(date: Date) {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

/**
 * Everything that happened to the account: sign-ins, billing, store changes and any
 * action an admin took. Catalog events live in each store's invalidation log.
 */
export default async function ActivityPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const [entries, stores] = await Promise.all([
    prisma.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.store.findMany({ where: { userId: user.id }, select: { id: true, name: true, url: true, lastEventAt: true }, orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-paper">Activity</h1>
        <p className="mt-1 text-[15px] text-paper/50">Account security, billing and store changes, newest first.</p>
      </div>

      {stores.length ? (
        <section>
          <h2 className="text-[17px] font-semibold text-paper">Store logs</h2>
          <p className="mt-1 text-[14px] text-paper/50">Every product, stock, price and order change Silo handled, with the pages it purged and warmed.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((s) => (
              <Link key={s.id} href={`/dashboard/stores/${s.id}/invalidations`} className="border border-white/8 bg-[#0b0d11] p-4 transition hover:border-accent/40">
                <p className="text-[15px] font-medium text-paper">{s.name}</p>
                <p className="mt-0.5 truncate font-mono text-[13px] text-paper/45">{s.url}</p>
                <p className="mt-2 text-[13px] text-paper/50">{s.lastEventAt ? `Last event ${when(s.lastEventAt)}` : "No events yet"}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-[17px] font-semibold text-paper">Account log</h2>
        {entries.length === 0 ? (
          <p className="mt-3 border border-white/8 bg-[#0b0d11] px-4 py-5 text-[14px] text-paper/50">Nothing recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto border border-white/8">
            <table className="w-full min-w-[600px] text-left text-[14px]">
              <thead className="bg-white/[0.03] text-[12px] uppercase tracking-wider text-paper/45">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">What</th>
                  <th className="px-4 py-2.5 font-medium">Detail</th>
                  <th className="px-4 py-2.5 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((e) => {
                  const byAdmin = e.actorId && e.actorId !== e.userId;
                  const warn = e.action.endsWith("failed") || e.action.startsWith("admin.");
                  return (
                    <tr key={e.id} className="text-paper/80">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[13px] text-paper/55">{when(e.createdAt)}</td>
                      <td className={`px-4 py-3 ${warn ? "text-amber" : ""}`}>
                        {AUDIT_LABELS[e.action] ?? e.action}
                        {byAdmin ? <span className="ml-2 text-[12px] text-paper/40">by Silo support</span> : null}
                      </td>
                      <td className="max-w-[320px] truncate px-4 py-3 text-paper/55">{e.target ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-[13px] text-paper/45">{e.ip ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
