import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-keys";
import { canCreateStore } from "@/lib/tier-enforcement";
import { getAccess } from "@/lib/entitlements";
import { audit } from "@/lib/audit";
import { checkPublicUrl } from "@/lib/url-guard";
import { PUBLIC_STORE_SELECT } from "@/lib/store-public";

export async function GET() {
  const session = await authSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, stores: { orderBy: { createdAt: "desc" }, select: PUBLIC_STORE_SELECT } },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ stores: user.stores });
}

export async function POST(req: Request) {
  const session = await authSession();
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

  const access = getAccess(user);
  if (!access.active) {
    return NextResponse.json({ error: access.message, code: "PLAN_INACTIVE" }, { status: 403 });
  }
  const tier = access.tier;
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
  const publicCheck = await checkPublicUrl(storeUrl);
  if (!publicCheck.ok) {
    return NextResponse.json({ error: `${publicCheck.reason}. Use the public address of your store.` }, { status: 400 });
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

  await audit("store.created", { userId: user.id, target: store.url, detail: { storeId: store.id, name: store.name }, req });

  return NextResponse.json({ store: { id: store.id, name: store.name, url: store.url, status: store.status }, apiKey: plain }, { status: 201 });
}
