export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const CANONICAL_ORIGIN = "https://heysilo.co";

/**
 * Public origin for canonical URLs, emails and Stripe return links. A Vercel preview
 * address (*.vercel.app) is never canonical, even if an env var still points at it.
 */
export function siteUrl() {
  const configured = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (!configured || /\.vercel\.app$/i.test(new URL(configured.startsWith("http") ? configured : `https://${configured}`).hostname)) {
    return CANONICAL_ORIGIN;
  }
  return configured;
}

export function formatDate(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
