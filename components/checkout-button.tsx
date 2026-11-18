"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CheckoutButtonProps = {
  tier: string;
  interval: "month" | "year";
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "outline";
};

export function CheckoutButton({
  tier,
  interval,
  children,
  className,
  variant = "primary",
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[11px] font-medium transition disabled:cursor-wait disabled:opacity-70",
        variant === "primary"
          ? "bg-accent text-white hover:bg-accent/90"
          : "border border-white/10 bg-white/5 text-paper/70 hover:bg-white/8",
        className,
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {children}
    </button>
  );
}
