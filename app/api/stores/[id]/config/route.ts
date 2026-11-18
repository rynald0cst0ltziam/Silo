import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyConnectorRequest } from "@/lib/hmac";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const verified = await verifyConnectorRequest(req);
  if (!verified) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (verified.storeId !== id) {
    return NextResponse.json({ error: "Store mismatch" }, { status: 403 });
  }

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      config: true,
      configVersion: true,
      status: true,
    },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const clientVersion = req.headers.get("x-silo-config-version");
  if (clientVersion && Number(clientVersion) >= store.configVersion) {
    return new NextResponse(null, { status: 304 });
  }

  await prisma.store.update({
    where: { id },
    data: { lastSeenAt: new Date() },
  });

  return NextResponse.json({
    config: store.config,
    version: store.configVersion,
    status: store.status,
  });
}
