import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { audit } from "@/lib/audit";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await authSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const store = await prisma.store.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const { plain, hash } = generateApiKey();

  await prisma.store.update({
    where: { id },
    data: { apiKey: plain, apiKeyHash: hash },
  });

  await audit("store.key_regenerated", { userId: session.user.id, target: store.url, detail: { storeId: id }, req });

  return NextResponse.json({ apiKey: plain });
}
