import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { getUserTier, canCreateStore } from "@/lib/tier-enforcement";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true, stores: { orderBy: { createdAt: "desc" } } },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ stores: user.stores });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getUserTier(user.subscription);
  const storeCheck = await canCreateStore(user.id, tier);
  if (!storeCheck.allowed) {
    return NextResponse.json(
      {
        error: `Store limit reached (${storeCheck.current}/${storeCheck.max}). Upgrade your plan to add more stores.`,
        code: "STORE_LIMIT",
      },
      { status: 403 },
    );
  }

  let body: { name: string; url: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { name, url } = body;
  if (!name?.trim() || !url?.trim()) {
    return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
  }

  let storeUrl: string;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    storeUrl = parsed.origin;
  } catch {
    return NextResponse.json({ error: "Invalid store URL" }, { status: 400 });
  }

  const existing = await prisma.store.findFirst({
    where: { userId: user.id, url: storeUrl },
  });
  if (existing) {
    return NextResponse.json({ error: "A store with this URL already exists" }, { status: 409 });
  }

  const { plain, hash } = generateApiKey();

  const store = await prisma.store.create({
    data: {
      userId: user.id,
      name: name.trim(),
      url: storeUrl,
      apiKey: plain,
      apiKeyHash: hash,
    },
  });

  return NextResponse.json({ store, apiKey: plain }, { status: 201 });
}
