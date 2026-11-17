import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier, type TierSlug } from "@/lib/tiers";

export const metadata: Metadata = {
  title: "Store",
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

export default async function StoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
  });

  if (!store) notFound();

  const tier = user.subscription
    ? getTier(user.subscription.tier)
    : null;

  const recentEvents = await prisma.event.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-tight text-paper">
              {store.name}
            </h1>
            <StatusBadge status={store.status} />
          </div>
          <p className="mt-1 font-mono text-[10px] text-paper/30">
            {store.url}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Hit rate", value: `${(store.hitRate * 100).toFixed(1)}%` },
          {
            label: "Events this month",
            value: `${store.monthlyEvents.toLocaleString()}${tier ? ` / ${(tier.maxMonthlyEvents / 1000).toFixed(0)}k` : ""}`,
          },
          {
            label: "Last event",
            value: store.lastEventAt
              ? new Date(store.lastEventAt).toLocaleString()
              : "—",
          },
          {
            label: "Connector",
            value: store.lastSeenAt
              ? `Online · ${new Date(store.lastSeenAt).toLocaleTimeString()}`
              : "Not connected",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/8 bg-[#0b0d11] p-4"
          >
            <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
              {stat.label}
            </p>
            <p className="mt-1.5 font-mono text-[14px] text-paper/70">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h2 className="text-[13px] font-medium text-paper/70">
          Recent invalidations
        </h2>
        {recentEvents.length === 0 ? (
          <p className="mt-4 text-[11px] text-paper/30">
            No events recorded yet. Connect the Silo connector plugin and events will appear here.
          </p>
        ) : (
          <div className="mt-3 space-y-1.5">
            {recentEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between rounded border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[9px] text-accent/70">
                    {event.type}
                  </span>
                </div>
                <span className="font-mono text-[8px] text-paper/25">
                  {new Date(event.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
