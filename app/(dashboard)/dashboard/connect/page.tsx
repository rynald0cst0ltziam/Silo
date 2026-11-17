import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Connect a store",
  robots: { index: false, follow: false },
};

export default async function ConnectPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-paper">
        Connect a store
      </h1>
      <p className="mt-1 text-[12px] text-paper/40">
        Add a WooCommerce store to your Silo account.
      </p>

      <div className="mt-6 max-w-xl">
        <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-5">
          <p className="text-[12px] text-paper/50">
            The connection wizard will be available once billing is configured.
            For now, the store creation API is in place.
          </p>
        </div>
      </div>
    </div>
  );
}
