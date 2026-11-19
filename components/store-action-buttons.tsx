"use client";

import { useState } from "react";
import { RefreshCw, Trash, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function RescanButton({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRescan() {
    setLoading(true);
    await fetch(`/api/stores/${storeId}/rescan`, { method: "POST" });
    router.refresh();
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleRescan}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] font-medium text-paper/60 transition hover:bg-white/[0.06] hover:text-paper/80 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Rescan
    </button>
  );
}

export function PurgeAllButton({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  async function handlePurge() {
    setLoading(true);
    await fetch(`/api/stores/${storeId}/purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purgeAll: true }),
    });
    router.refresh();
    setLoading(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-amber-400/70">Purge entire cache?</span>
        <button
          type="button"
          onClick={handlePurge}
          disabled={loading}
          className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[12px] text-amber-300 hover:bg-amber-500/20"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-[12px] text-paper/30 hover:text-paper/50"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-3 py-2 text-[12px] font-medium text-amber-300/70 transition hover:bg-amber-500/[0.08]"
    >
      <Trash className="h-3 w-3" />
      Purge all
    </button>
  );
}
