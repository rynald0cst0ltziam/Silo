import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { canCreateStore } from "@/lib/tier-enforcement";
import { getAccess } from "@/lib/entitlements";
import { CreateStoreForm } from "@/components/create-store-form";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Connect a store",
  robots: { index: false, follow: false },
};

export default async function ConnectPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const access = getAccess(user);
  const tier = access.tier;
  const storeCheck = await canCreateStore(user.id, tier);

  return (
    <div>
      <h1 className="text-[26px] font-semibold tracking-tight text-paper">
        Connect a store
      </h1>
      <p className="mt-1 text-[14px] text-paper/40">
        Add a WooCommerce store to your Silo account.
      </p>

      <div className="mt-1 font-mono text-[12px] text-paper/25">
        {storeCheck.current}/{storeCheck.max} stores used · {access.plan ? `${tier.name} plan` : access.message}
      </div>

      <div className="mt-6">
        {!access.active ? (
          <div className="max-w-xl border border-red-500/25 bg-red-500/[0.05] p-5">
            <p className="text-[15px] font-medium text-paper/85">Caching is paused on this account</p>
            <p className="mt-1 text-[14px] text-paper/55">{access.message}</p>
            {access.state !== "suspended" ? (
              <Link href="/dashboard/billing" className="mt-4 inline-flex items-center bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-accent/90">
                Choose a plan
              </Link>
            ) : null}
          </div>
        ) : storeCheck.allowed ? (
          <CreateStoreForm />
        ) : (
          <div className="max-w-xl rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <p className="text-[15px] font-medium text-paper/70">Store limit reached</p>
            <p className="mt-1 text-[13px] text-paper/40">
              Your {tier.name} plan supports up to {tier.maxStores} store{tier.maxStores > 1 ? "s" : ""}. Upgrade to add more.
            </p>
            <Link
              href="/dashboard/billing"
              className="mt-4 inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-accent/90"
            >
              Upgrade plan
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
