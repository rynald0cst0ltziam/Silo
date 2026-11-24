import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { callConnector } from "@/lib/connector";
import { audit } from "@/lib/audit";

/** Support actions on any store: ask its connector to purge everything or rescan. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  const store = await prisma.store.findUnique({ where: { id }, select: { id: true, url: true, apiKey: true, userId: true } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: string };
  if (body.action !== "purge" && body.action !== "rescan") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result =
    body.action === "purge"
      ? await callConnector<{ purged?: number }>(store, "POST", "/purge", { all: true, reset_stats: false })
      : await callConnector(store, "POST", "/scan", {});
  if (!result.ok) {
    return NextResponse.json({ error: `The connector could not be reached (${result.error}).` }, { status: 502 });
  }

  await audit(body.action === "purge" ? "store.purged" : "store.rescan", {
    userId: store.userId,
    actorId: admin.id,
    target: store.url,
    detail: { storeId: id, by: "admin" },
    req,
  });
  return NextResponse.json({ ok: true, data: result.data });
}
