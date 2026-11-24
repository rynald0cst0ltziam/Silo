import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callConnector } from "@/lib/connector";
import { getStoreAccess } from "@/lib/entitlements";
import { audit } from "@/lib/audit";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Ask the connector to run a fresh catalog scan in the background. Progress streams
 * back through /api/stores/scan and is shown live on the dashboard.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, apiKey: true },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const access = await getStoreAccess(id, session.user.id);
  if (!access?.storeActive) {
    return NextResponse.json({ error: access?.storeMessage ?? "Account not found", code: "PLAN_INACTIVE" }, { status: 403 });
  }
  await audit("store.rescan", { userId: session.user.id, target: store.url, detail: { storeId: id }, req });

  const result = await callConnector<{ started?: boolean; running?: boolean; state?: Record<string, unknown> }>(store, "POST", "/scan", {});
  if (!result.ok) {
    return NextResponse.json(
      { error: `The connector could not be reached (${result.error}). Start the scan from WooCommerce → Silo → Catalog.` },
      { status: 502 },
    );
  }

  if (result.data.state) {
    await prisma.store.update({
      where: { id },
      data: { scanState: result.data.state as Prisma.InputJsonValue, status: "scanning", lastSeenAt: new Date() },
    });
  }

  return NextResponse.json({ status: result.data.running ? "already_running" : "started", scan: result.data.state ?? null });
}
