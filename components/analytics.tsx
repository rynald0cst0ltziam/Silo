"use client";

import Script from "next/script";

/**
 * Privacy-friendly analytics. Renders nothing until a domain is configured.
 * Swap for PostHog by setting the env var and replacing this component.
 */
export function Analytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

  if (!domain) return null;

  return (
    <Script
      defer
      data-domain={domain}
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  );
}
