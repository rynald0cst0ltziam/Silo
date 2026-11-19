"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Trash } from "lucide-react";

type Notify = (message: string, kind?: "ok" | "error") => void;

export function RescanButton({ storeId, onDone, disabled }: { storeId: string; onDone?: Notify; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function handleRescan() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/rescan`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Rescan failed");
      onDone?.(data.status === "already_running" ? "A scan is already running" : "Scan started on the store — progress appears below");
    } catch (err) {
      onDone?.(err instanceof Error ? err.message : "Rescan failed", "error");
    }
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={handleRescan}
      disabled={loading || disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[14px] font-medium text-paper/60 transition hover:bg-white/[0.06] hover:text-paper/80 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
      Rescan catalog
    </button>
  );
}

export function PurgeAllButton({ storeId, onDone }: { storeId: string; onDone?: Notify }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handlePurge() {
    setLoading(true);
    try {
      const res = await fetch(`/api/stores/${storeId}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purgeAll: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Purge failed");
      onDone?.(`Purged ${Number(data.purged ?? 0).toLocaleString()} cached entries · stats reset · ${data.warming ?? 0} priority URLs re-warming`);
    } catch (err) {
      onDone?.(err instanceof Error ? err.message : "Purge failed", "error");
    }
    setLoading(false);
    setConfirming(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[14px] text-amber/80">Purge every cached page and reset stats?</span>
        <button
          type="button"
          onClick={handlePurge}
          disabled={loading}
          className="inline-flex items-center rounded border border-amber/30 bg-amber/10 px-2 py-1 text-[14px] text-amber hover:bg-amber/20"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Purge"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-[14px] text-paper/30 hover:text-paper/50">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-1.5 rounded-lg border border-amber/20 bg-amber/[0.04] px-3 py-2 text-[14px] font-medium text-amber/80 transition hover:bg-amber/[0.08]"
    >
      <Trash className="h-3 w-3" />
      Purge all
    </button>
  );
}
