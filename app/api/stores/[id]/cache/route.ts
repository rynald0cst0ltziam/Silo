import { NextResponse } from "next/server";
import { createHmac } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, apiKey: true },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  try {
    const storeUrl = store.url.replace(/\/+$/, "");
    const body = "";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", store.apiKey)
      .update(`${timestamp}.${body}`)
      .digest("hex");

    const resp = await fetch(`${storeUrl}/wp-json/silo/v1/cached-urls?limit=100`, {
      method: "GET",
      headers: {
        "X-Silo-Signature": signature,
        "X-Silo-Timestamp": timestamp,
        "X-Silo-Store-Key": store.apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json(
        { error: `Connector returned ${resp.status}`, cached_urls: [], stats: null },
        { status: 200 },
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Connection failed",
        cached_urls: [],
        stats: null,
      },
      { status: 200 },
    );
  }
}
