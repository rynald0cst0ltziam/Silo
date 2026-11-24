"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function AdminStoreActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: "purge" | "rescan") {
    setBusy(action);
    setNote(null);
    const res = await fetch(`/api/admin/stores/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "Network error" };
    setBusy(null);
    setNote(res?.ok ? { ok: true, text: action === "purge" ? "Purge sent to the connector" : "Rescan started" } : { ok: false, text: data.error ?? "Failed" });
    router.refresh();
  }

  const cls = "inline-flex h-9 items-center gap-2 bg-white/[0.07] px-3 text-[13px] font-medium text-paper transition hover:bg-white/[0.12] disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={cls} disabled={!!busy} onClick={() => run("rescan")}>
        {busy === "rescan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Rescan catalog
      </button>
      <button type="button" className={cls} disabled={!!busy} onClick={() => run("purge")}>
        {busy === "purge" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}Purge all
      </button>
      {note ? <span className={`text-[13px] ${note.ok ? "text-mint" : "text-red-300"}`}>{note.text}</span> : null}
    </div>
  );
}
