import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StoreProfilePanel } from "@/components/store-profile";
import { StoreConfigDetails } from "@/components/store-config-details";
import { RescanButton } from "@/components/store-action-buttons";

export const metadata: Metadata = {
  title: "Store Catalog",
  robots: { index: false, follow: false },
};

export default async function StoreCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
  });

  if (!store) notFound();

  const storeProfile = store.profile as Parameters<typeof StoreProfilePanel>[0]["profile"];
  const storeConfig = store.config as Parameters<typeof StoreConfigDetails>[0]["config"];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-tight text-paper">
            Catalog
          </h2>
          <p className="mt-0.5 font-mono text-[9px] text-paper/25">
            Store scan results and detected capabilities
          </p>
        </div>
        <RescanButton storeId={store.id} />
      </div>

      {/* Store profile / scan results */}
      <div className="mt-5 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[12px] font-medium text-paper/70">
            Store scan
          </h3>
          {store.lastScanAt && (
            <span className="font-mono text-[8px] text-paper/25">
              Last scanned{" "}
              {new Date(store.lastScanAt).toLocaleString()}
            </span>
          )}
        </div>
        <StoreProfilePanel profile={storeProfile} />
      </div>

      {/* Active config */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[12px] font-medium text-paper/70">
            Active configuration
          </h3>
          <span className="rounded border border-white/8 px-1.5 py-0.5 font-mono text-[8px] text-paper/30">
            v{store.configVersion}
          </span>
        </div>
        <StoreConfigDetails config={storeConfig} />
      </div>
    </div>
  );
}
