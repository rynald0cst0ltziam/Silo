import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Live scan progress from the connector. The dashboard renders this state as the
 * same animated scan the merchant sees in WordPress.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<{ state?: Record<string, unknown> }>(req);
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const state = body.state;
  if (!state || typeof state !== "object") {
    return NextResponse.json({ error: "Missing scan state" }, { status: 400 });
  }

  const status = String(state.status ?? "");
  await prisma.store.update({
    where: { id: store.id },
    data: {
      scanState: state as Prisma.InputJsonValue,
      lastSeenAt: new Date(),
      ...(status === "running" ? { status: "scanning" } : {}),
      ...(status === "failed" ? { status: "error" } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
