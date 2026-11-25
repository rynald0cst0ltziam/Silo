export type Interval = "month" | "year";

const PLAN_SLUGS = ["solo", "studio", "portfolio"] as const;
export type PlanSlug = (typeof PLAN_SLUGS)[number];

export function asPlan(value: unknown): PlanSlug | null {
  return typeof value === "string" && (PLAN_SLUGS as readonly string[]).includes(value) ? (value as PlanSlug) : null;
}

export function asInterval(value: unknown): Interval | null {
  return value === "month" || value === "year" ? value : null;
}

/** Billing page with a plan and interval preselected. */
export function billingUrl(plan: PlanSlug, interval: Interval): string {
  return `/dashboard/billing?plan=${plan}&interval=${interval}#plans`;
}

/** Only same-site relative paths are followed after sign-in or sign-up (no open redirects). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

/** Monthly equivalent of an annual price, e.g. 290 -> "24.17". */
export function perMonth(annual: number): string {
  return (annual / 12).toFixed(2);
}
