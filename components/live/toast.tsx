"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export function useToast() {
  const [toast, setToast] = useState<{ message: string; kind: "ok" | "error"; id: number } | null>(null);

  const notify = useCallback((message: string, kind: "ok" | "error" = "ok") => {
    const id = Date.now();
    setToast({ message, kind, id });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 4500);
  }, []);

  const node = toast ? (
    <div
      role="status"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-2.5 rounded-xl border bg-[#10131a] px-4 py-3 text-[14.5px] text-paper shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)] animate-rise",
        toast.kind === "error" ? "border-rose/35" : "border-mint/30",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toast.kind === "error" ? "bg-rose" : "bg-mint")} />
      {toast.message}
    </div>
  ) : null;

  return { notify, node };
}
