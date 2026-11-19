import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { callConnector } from "@/lib/connector";

/**
 * Live cache inspection: what is cached on the store right now.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, apiKey: true },
  });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  const result = await callConnector<{ cached_urls?: unknown[]; inventory?: unknown; stats?: unknown }>(store, "GET", "/cached-urls?limit=200");
  if (!result.ok) {
    return NextResponse.json({ error: result.error, cached_urls: [], inventory: null, stats: null });
  }
  return NextResponse.json(result.data);
}
