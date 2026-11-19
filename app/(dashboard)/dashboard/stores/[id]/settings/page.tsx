import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  RegenerateKeyButton,
  DeleteStoreButton,
} from "@/components/store-actions";
import { PurgeAllButton } from "@/components/store-action-buttons";

export const metadata: Metadata = {
  title: "Store Settings",
  robots: { index: false, follow: false },
};

export default async function StoreSettingsPage({
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

  return (
    <div>
      <div>
        <h2 className="text-[21px] font-semibold tracking-tight text-paper">
          Settings
        </h2>
        <p className="mt-0.5 font-mono text-[13px] text-paper/25">
          Store connection and configuration
        </p>
      </div>

      {/* Connection details */}
      <div className="mt-5 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h3 className="text-[15px] font-medium text-paper/70">
          Connection
        </h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">
                Store URL
              </p>
              <p className="mt-1 font-mono text-[13px] text-paper/60">
                {store.url}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">
                Status
              </p>
              <p className="mt-1 font-mono text-[13px] text-paper/60 capitalize">
                {store.status}
              </p>
            </div>
            {store.lastSeenAt && (
              <span className="font-mono text-[11px] text-paper/25">
                Last seen {new Date(store.lastSeenAt).toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-white/6 bg-white/[0.02] px-4 py-3">
            <div>
              <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">
                Config version
              </p>
              <p className="mt-1 font-mono text-[13px] text-paper/60">
                v{store.configVersion}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* API key */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h3 className="text-[15px] font-medium text-paper/70">API key</h3>
        <div className="mt-3">
          <p className="font-mono text-[13px] text-paper/30">
            Key prefix:{" "}
            <code className="text-paper/50">
              sk_silo_...{store.apiKeyHash.slice(-6)}
            </code>
          </p>
          <div className="mt-3">
            <RegenerateKeyButton storeId={store.id} />
          </div>
        </div>
      </div>

      {/* Cache controls */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h3 className="text-[15px] font-medium text-paper/70">
          Cache controls
        </h3>
        <p className="mt-2 text-[14px] text-paper/30">
          Purge the entire cache for this store. All cached pages will be
          cleared and re-warmed on next visit.
        </p>
        <div className="mt-3">
          <PurgeAllButton storeId={store.id} />
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-4 rounded-xl border border-red-500/15 bg-red-500/[0.02] p-5">
        <h3 className="text-[15px] font-medium text-red-400/70">
          Danger zone
        </h3>
        <p className="mt-2 text-[14px] text-paper/30">
          Permanently delete this store and all associated data. This action
          cannot be undone.
        </p>
        <div className="mt-3">
          <DeleteStoreButton storeId={store.id} storeName={store.name} />
        </div>
      </div>
    </div>
  );
}
