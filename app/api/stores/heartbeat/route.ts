import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { ingestHeartbeat, type HeartbeatPayload } from "@/lib/connector";
import { planStatus } from "@/lib/plan-status";

/**
 * Connector heartbeat: cumulative counters (deltas computed here), inventory, queue
 * depth and environment. Returns a newer config when Silo has one.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<HeartbeatPayload & { ping?: boolean }>(req);
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const [result, plan] = await Promise.all([ingestHeartbeat(store.id, body), planStatus(store.userId, auth.access)]);

  const current = await prisma.store.findUnique({
    where: { id: store.id },
    select: { config: true, configVersion: true, status: true, name: true, url: true },
  });

  const clientVersion = Number(body.config_version ?? 0);
  const newer = current && current.config && current.configVersion > clientVersion;

  return NextResponse.json({
    status: "ok",
    accepted: result.accepted,
    config_version: current?.configVersion ?? 0,
    ...(newer ? { config: current!.config } : {}),
    store: current ? { name: current.name, url: current.url } : undefined,
    plan,
    server_time: Math.floor(Date.now() / 1000),
  });
}
