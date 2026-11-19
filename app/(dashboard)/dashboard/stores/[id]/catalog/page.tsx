import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { getStoreLive } from "@/lib/store-live";
import { CatalogPageLive } from "@/components/live/store-subpages";

export const metadata: Metadata = { title: "Store Catalog", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function StoreCatalogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const store = await prisma.store.findFirst({ where: { id, userId: user.id }, select: { id: true, profile: true, config: true } });
  if (!store) notFound();
  const live = await getStoreLive(store.id, getUserTier(user.subscription));
  if (!live) notFound();

  return (
    <CatalogPageLive
      storeId={store.id}
      initial={live}
      profile={store.profile as Parameters<typeof CatalogPageLive>[0]["profile"]}
      config={store.config as Parameters<typeof CatalogPageLive>[0]["config"]}
    />
  );
}
