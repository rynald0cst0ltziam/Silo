import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { generateConfig, type StoreSnapshot } from "@/lib/config-engine";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
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

  const profile = store.profile as StoreSnapshot | null;
  if (!profile) {
    return NextResponse.json(
      { error: "No profile available. The connector must connect first." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const tier = getUserTier(user.subscription);
  const config = generateConfig(tier, profile, store.configVersion);

  await prisma.store.update({
    where: { id },
    data: {
      status: "optimized",
      config: JSON.parse(JSON.stringify(config)),
      configVersion: config.version,
      lastScanAt: new Date(),
    },
  });

  return NextResponse.json({
    status: "rescanned",
    configVersion: config.version,
  });
}
