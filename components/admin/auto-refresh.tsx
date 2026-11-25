"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-renders the server page on an interval so the admin numbers stay live.
 * Pauses while the tab is hidden.
 */
export function AutoRefresh({ intervalSeconds = 30 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const [updated, setUpdated] = useState<string>("");

  useEffect(() => {
    const stamp = () => setUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" }));
    stamp();
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      stamp();
    }, intervalSeconds * 1000);
    return () => clearInterval(timer);
  }, [router, intervalSeconds]);

  return (
    <div className="flex items-center gap-2 font-mono text-[12px] text-paper/50">
      <span className="live-dot bg-mint text-mint" aria-hidden="true" />
      <span>Live · updated {updated} UTC</span>
    </div>
  );
}
