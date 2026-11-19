"use client";

import { useState } from "react";
import { Copy, Check, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function RegenerateKeyButton({ storeId }: { storeId: string }) {
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function regenerate() {
    setLoading(true);
    const res = await fetch(`/api/stores/${storeId}/regenerate-key`, { method: "POST" });
    const data = await res.json();
    if (data.apiKey) {
      setNewKey(data.apiKey);
    }
    setLoading(false);
    setConfirming(false);
  }

  async function copyKey() {
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (newKey) {
    return (
      <div className="rounded-lg border border-mint/20 bg-mint/[0.04] p-3">
        <p className="text-[12px] font-medium text-mint/70">New API key generated</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 rounded border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-[12px] text-paper/80 select-all">
            {newKey}
          </code>
          <button type="button" onClick={copyKey} className="text-paper/40 hover:text-paper/70">
            {copied ? <Check className="h-3.5 w-3.5 text-mint" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-amber-400/60">
          Copy now — won't be shown again. Update the key in your WordPress connector settings.
        </p>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-amber-400/70">Regenerate? Old key stops working immediately.</span>
        <button
          type="button"
          onClick={regenerate}
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
      className="inline-flex items-center gap-1.5 text-[12px] text-paper/40 transition hover:text-paper/70"
    >
      <RefreshCw className="h-3 w-3" />
      Regenerate key
    </button>
  );
}

export function DeleteStoreButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-red-400/70">Delete &quot;{storeName}&quot;? This cannot be undone.</span>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[12px] text-red-400 hover:bg-red-500/20"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Delete"}
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
      className="inline-flex items-center gap-1.5 text-[12px] text-red-400/40 transition hover:text-red-400/70"
    >
      <Trash2 className="h-3 w-3" />
      Delete store
    </button>
  );
}
