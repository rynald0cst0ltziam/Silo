import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { getStoreLive } from "@/lib/store-live";
import { pullConnectorIfQuiet } from "@/lib/connector";

export const dynamic = "force-dynamic";

/**
 * Everything the store dashboard renders, polled every few seconds.
 * If the connector has been quiet, it is asked directly for fresh numbers first.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
    select: { id: true, url: true, apiKey: true, lastSeenAt: true, status: true },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  if (store.status !== "pending") {
    await pullConnectorIfQuiet(store);
  }

  const take = Math.min(100, Math.max(10, Number(new URL(req.url).searchParams.get("events") ?? 25)));
  const live = await getStoreLive(store.id, getUserTier(user.subscription), { events: take });
  return NextResponse.json(live, { headers: { "Cache-Control": "no-store" } });
}
