import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTier } from "@/lib/tiers";
import { InvalidationLogTable } from "@/components/invalidation-log-table";
import { EventUsageMeter } from "@/components/event-usage-meter";

export const metadata: Metadata = {
  title: "Invalidations",
  robots: { index: false, follow: false },
};

export default async function StoreInvalidationsPage({
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

  const tier = user.subscription ? getTier(user.subscription.tier) : null;
  const maxEvents = tier?.maxMonthlyEvents ?? 100_000;

  const recentEvents = await prisma.event.findMany({
    where: { storeId: store.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const eventLogData = recentEvents.map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload as Record<string, unknown> | null,
    purgeUrls: Array.isArray(e.purgeUrls) ? (e.purgeUrls as string[]) : [],
    warmUrls: Array.isArray(e.warmUrls) ? (e.warmUrls as string[]) : [],
    processed: e.processed,
    createdAt: e.createdAt.toISOString(),
  }));

  // Stats
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const last24h = recentEvents.filter(
    (e) => new Date(e.createdAt) >= twentyFourHoursAgo
  );
  const totalPurged = last24h.reduce(
    (s, e) => s + (Array.isArray(e.purgeUrls) ? (e.purgeUrls as string[]).length : 0),
    0
  );
  const totalWarmed = last24h.reduce(
    (s, e) => s + (Array.isArray(e.warmUrls) ? (e.warmUrls as string[]).length : 0),
    0
  );

  return (
    <div>
      <div>
        <h2 className="text-[18px] font-semibold tracking-tight text-paper">
          Invalidations
        </h2>
        <p className="mt-0.5 font-mono text-[9px] text-paper/25">
          Real-time cache invalidation event log
        </p>
      </div>

      {/* Stats row */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3 py-3">
          <p className="font-mono text-[7px] uppercase tracking-wider text-paper/25">
            Events (24h)
          </p>
          <p className="mt-1 font-mono text-[18px] font-semibold text-paper">
            {last24h.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3 py-3">
          <p className="font-mono text-[7px] uppercase tracking-wider text-paper/25">
            URLs purged
          </p>
          <p className="mt-1 font-mono text-[18px] font-semibold text-paper">
            {totalPurged}
          </p>
        </div>
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] px-3 py-3">
          <p className="font-mono text-[7px] uppercase tracking-wider text-paper/25">
            URLs re-warmed
          </p>
          <p className="mt-1 font-mono text-[18px] font-semibold text-paper">
            {totalWarmed}
          </p>
        </div>
      </div>

      {/* Usage meter */}
      <div className="mt-3 rounded-xl border border-white/8 bg-[#0b0d11] p-4">
        <EventUsageMeter used={store.monthlyEvents} max={maxEvents} />
      </div>

      {/* Full event log */}
      <div className="mt-4 overflow-hidden rounded-xl border border-white/8 bg-[#0b0d11]">
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
          <p className="text-[11px] font-medium text-paper/65">Event log</p>
          <span className="font-mono text-[8px] text-paper/25">
            {recentEvents.length} events
          </span>
        </div>
        <InvalidationLogTable events={eventLogData} />
      </div>
    </div>
  );
}
