import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { getUserTier, canCreateStore } from "@/lib/tier-enforcement";
import { CreateStoreForm } from "@/components/create-store-form";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connect a store",
  robots: { index: false, follow: false },
};

export default async function ConnectPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const tier = getUserTier(user.subscription);
  const storeCheck = await canCreateStore(user.id, tier);

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-paper">
        Connect a store
      </h1>
      <p className="mt-1 text-[12px] text-paper/40">
        Add a WooCommerce store to your Silo account.
      </p>

      <div className="mt-1 font-mono text-[10px] text-paper/25">
        {storeCheck.current}/{storeCheck.max} stores used · {tier.name} plan
      </div>

      <div className="mt-6">
        {storeCheck.allowed ? (
          <CreateStoreForm />
        ) : (
          <div className="max-w-xl rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <p className="text-[13px] font-medium text-paper/70">Store limit reached</p>
            <p className="mt-1 text-[11px] text-paper/40">
              Your {tier.name} plan supports up to {tier.maxStores} store{tier.maxStores > 1 ? "s" : ""}. Upgrade to add more.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-accent/90"
            >
              Upgrade plan
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
