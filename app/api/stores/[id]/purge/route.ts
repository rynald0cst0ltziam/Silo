import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";

export async function POST(
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
    select: { id: true, url: true },
  });

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  let body: { urls?: string[]; purgeAll?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { urls, purgeAll } = body;

  if (!purgeAll && (!urls || urls.length === 0)) {
    return NextResponse.json(
      { error: "Provide urls array or purgeAll: true" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });

  const tier = getUserTier(user?.subscription ?? null);

  let purgeUrls: string[];

  if (purgeAll) {
    purgeUrls = [`${store.url.replace(/\/+$/, "")}/*`];
  } else {
    purgeUrls = urls!.slice(0, 500);
  }

  const warmUrls = purgeUrls
    .filter((u) => !u.includes("*"))
    .slice(0, tier.warmupUrlsPerEvent);

  const event = await prisma.event.create({
    data: {
      storeId: id,
      type: "manual_purge",
      payload: { purgeAll: !!purgeAll, urlCount: purgeUrls.length },
      purgeUrls,
      warmUrls,
      processed: true,
    },
  });

  await prisma.store.update({
    where: { id },
    data: {
      lastEventAt: new Date(),
      monthlyEvents: { increment: 1 },
    },
  });

  if (warmUrls.length > 0) {
    await prisma.warmupJob.create({
      data: {
        storeId: id,
        urls: warmUrls,
        total: warmUrls.length,
        status: "pending",
      },
    });
  }

  return NextResponse.json({
    event_id: event.id,
    purged: purgeUrls.length,
    warming: warmUrls.length,
  });
}
