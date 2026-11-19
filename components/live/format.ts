export function ago(input: string | number | null | undefined, now = Date.now()): string {
  if (input === null || input === undefined) return "—";
  const t = typeof input === "number" ? (input < 1e12 ? input * 1000 : input) : Date.parse(input);
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ms(v: number | null | undefined): string {
  const n = Number(v ?? 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}s`;
  return `${Math.round(n)}ms`;
}

export function bytes(b: number | null | undefined): string {
  const n = Number(b ?? 0);
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return decodeURI(u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}

export const STATE_STYLE: Record<string, { label: string; cls: string }> = {
  purged: { label: "Purged", cls: "border-white/10 bg-white/[0.03] text-paper/50" },
  queued: { label: "Queued", cls: "border-accent/25 bg-accent/10 text-accent-hi" },
  warming: { label: "Warming", cls: "border-amber/25 bg-amber/10 text-amber" },
  warm: { label: "Re-warmed", cls: "border-mint/25 bg-mint/10 text-mint" },
  partial: { label: "Partly warmed", cls: "border-amber/25 bg-amber/10 text-amber" },
  failed: { label: "Warm failed", cls: "border-rose/25 bg-rose/10 text-rose" },
  done: { label: "Done", cls: "border-white/10 bg-white/[0.03] text-paper/40" },
};
