import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    optimized: "bg-mint/10 text-mint/70 border-mint/20",
    scanning: "bg-amber/10 text-amber/70 border-amber/20",
    pending: "bg-white/5 text-paper/40 border-white/10",
    error: "bg-red-500/10 text-red-400/70 border-red-500/20",
    offline: "bg-red-500/10 text-red-400/70 border-red-500/20",
  };

  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wider ${styles[status] ?? styles.pending}`}
    >
      {status}
    </span>
  );
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const stores = await prisma.store.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-paper">
            Stores
          </h1>
          <p className="mt-1 text-[12px] text-paper/40">
            {stores.length === 0
              ? "Connect your first WooCommerce store."
              : `${stores.length} store${stores.length !== 1 ? "s" : ""} connected`}
          </p>
        </div>
        <Link
          href="/dashboard/connect"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[11px] font-medium text-white transition hover:bg-accent/90"
        >
          <Plus className="h-3.5 w-3.5" />
          Add store
        </Link>
      </div>

      {stores.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-[13px] text-paper/50">No stores connected yet.</p>
          <p className="mt-1 text-[11px] text-paper/30">
            Add a store to start caching your WooCommerce catalog.
          </p>
          <Link
            href="/dashboard/connect"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" />
            Connect your first store
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/dashboard/stores/${store.id}`}
              className="group rounded-xl border border-white/8 bg-[#0b0d11] p-4 transition hover:border-white/14"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-paper/80">
                    {store.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[9px] text-paper/30">
                    {store.url}
                  </p>
                </div>
                <StatusBadge status={store.status} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/6 pt-3">
                <div>
                  <p className="font-mono text-[8px] text-paper/25">Hit rate</p>
                  <p className="mt-0.5 font-mono text-[13px] text-paper/70">
                    {(store.hitRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8px] text-paper/25">Events</p>
                  <p className="mt-0.5 font-mono text-[13px] text-paper/70">
                    {store.monthlyEvents.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[8px] text-paper/25">Last seen</p>
                  <p className="mt-0.5 font-mono text-[9px] text-paper/40">
                    {store.lastSeenAt
                      ? new Date(store.lastSeenAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
