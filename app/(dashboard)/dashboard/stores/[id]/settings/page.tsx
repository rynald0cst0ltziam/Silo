import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  RegenerateKeyButton,
  DeleteStoreButton,
} from "@/components/store-actions";
import { PurgeAllButton } from "@/components/store-action-buttons";
import { Download } from "lucide-react";
import { isOutdated, latestConnectorVersion } from "@/lib/connector-release";

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

  const latest = await latestConnectorVersion();
  const installed = store.connectorVersion;
  const outdated = isOutdated(installed, latest);

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

      {/* Connector plugin */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-medium text-paper/70">Connector plugin</h3>
            <p className="mt-1.5 text-[14px] text-paper/45">
              Latest version {latest ? <span className="font-mono text-paper/75">v{latest}</span> : "available below"}
              {" · "}
              {installed ? (
                <>
                  installed on this store{" "}
                  <span className={`font-mono ${outdated ? "text-amber" : "text-mint"}`}>v{installed}</span>
                  {outdated ? " (update available)" : " (up to date)"}
                </>
              ) : (
                "not installed yet"
              )}
            </p>
          </div>
          <a
            href="/api/connector/download"
            download
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-white transition hover:bg-accent/90"
          >
            <Download className="h-4 w-4" />
            Download silo-connector.zip
          </a>
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-paper/50">
          <li>In WordPress, go to Plugins → Add New → Upload Plugin and choose the ZIP.</li>
          <li>When WordPress says the plugin already exists, choose <span className="text-paper/75">Replace current with uploaded</span>.</li>
          <li>Your store key, settings and logs are kept. No need to reconnect or rescan.</li>
        </ol>
      </div>

      {/* API key */}
      <div className="mt-4 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <h3 className="text-[15px] font-medium text-paper/70">API key</h3>
        <div className="mt-3">
          <p className="font-mono text-[13px] text-paper/30">
            Key fingerprint:{" "}
            <code className="text-paper/50">
              …{store.apiKeyHash.slice(-6)}
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
