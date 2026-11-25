"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sends one page view per navigation to our own endpoint. No cookies, no third party.
 * Respects Do Not Track and Global Privacy Control.
 */
export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (navigator.doNotTrack === "1" || nav.globalPrivacyControl) return;

    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || null });
    try {
      const sent = navigator.sendBeacon?.("/api/analytics/pageview", new Blob([payload], { type: "application/json" }));
      if (!sent) {
        fetch("/api/analytics/pageview", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => undefined);
      }
    } catch {
      // Analytics must never break the page.
    }
  }, [pathname]);

  return null;
}
