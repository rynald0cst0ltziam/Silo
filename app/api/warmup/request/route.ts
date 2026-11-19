import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { getUserTier } from "@/lib/tier-enforcement";
import type { SiloConfig } from "@/lib/config-engine";

/**
 * The connector asks for a priority warmup (manual button in WordPress).
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<{ reason?: string }>(req);
  if (!auth.ok) return auth.response;
  const { store } = auth;

  const [user, record] = await Promise.all([
    prisma.user.findUnique({ where: { id: store.userId }, include: { subscription: true } }),
    prisma.store.findUnique({ where: { id: store.id }, select: { config: true } }),
  ]);
  const tier = getUserTier(user?.subscription ?? null);
  const config = record?.config as unknown as SiloConfig | null;
  const urls = (config?.priority_urls ?? []).slice(0, tier.warmupUrlsPerEvent);

  if (urls.length === 0) {
    return NextResponse.json({ error: "No priority URLs yet — run a catalog scan first" }, { status: 409 });
  }

  const job = await prisma.warmupJob.create({
    data: { storeId: store.id, urls, total: urls.length, status: "pending", source: "manual" },
  });

  return NextResponse.json({ job_id: job.id, urls });
}
