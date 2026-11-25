"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckoutButtonProps = {
  tier: string;
  interval: "month" | "year";
  /** Charge today instead of when the free trial ends. */
  startNow?: boolean;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline";
};

export function CheckoutButton({
  tier,
  interval,
  startNow = false,
  children,
  className,
  variant = "primary",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval, startNow }),
      });
      if (res.status === 401) {
        window.location.href = `/sign-up?next=${encodeURIComponent(`/dashboard/billing?plan=${tier}&interval=${interval}#plans`)}`;
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string; portal?: boolean };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.portal) {
        window.location.href = "/api/billing/portal";
        return;
      }
      setError(data.error ?? "Checkout could not start. Try again in a moment.");
      setLoading(false);
    } catch {
      setError("Checkout could not start. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <span className="flex flex-col items-stretch gap-1.5">
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium transition disabled:cursor-wait disabled:opacity-70",
        variant === "primary"
          ? "bg-accent text-white hover:bg-accent/90"
          : "border border-white/10 bg-white/5 text-paper/70 hover:bg-white/8",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
    {error ? <span role="alert" className="text-[13px] text-amber">{error}</span> : null}
    </span>
  );
}
