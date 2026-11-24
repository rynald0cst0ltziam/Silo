import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { getStoreLive } from "@/lib/store-live";
import { WarmupPageLive } from "@/components/live/store-subpages";

export const metadata: Metadata = { title: "Warmup", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StoreWarmupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const store = await prisma.store.findFirst({ where: { id, userId: user.id }, select: { id: true } });
  if (!store) notFound();
  const live = await getStoreLive(store.id, getUserTier(user));
  if (!live) notFound();
  return <WarmupPageLive storeId={store.id} initial={live} />;
}
