import Link from "next/link";
import type { AccessState } from "@/lib/entitlements";

export function PageHead({ title, intro, children }: { title: string; intro?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-paper">{title}</h1>
        {intro ? <p className="mt-1 text-[15px] text-paper/50">{intro}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "mint" | "amber" | "rose" | "accent" }) {
  const color = tone === "mint" ? "text-mint" : tone === "amber" ? "text-amber" : tone === "rose" ? "text-red-300" : tone === "accent" ? "text-accent" : "text-paper";
  return (
    <div className="border border-white/8 bg-[#0b0d11] p-4">
      <p className="text-[12px] font-medium uppercase tracking-wider text-paper/45">{label}</p>
      <p className={`mt-2 font-mono text-[26px] leading-none ${color}`}>{value}</p>
      {hint ? <p className="mt-2 text-[13px] text-paper/50">{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, intro, children, action }: { title: string; intro?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="border border-white/8 bg-[#0b0d11]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-paper">{title}</h2>
          {intro ? <p className="mt-0.5 text-[13px] text-paper/45">{intro}</p> : null}
        </div>
        {action}
      </div>
      <div>{children}</div>
    </section>
  );
}

export function Table({ head, children, minWidth = 720 }: { head: string[]; children: React.ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[14px]" style={{ minWidth }}>
        <thead className="bg-white/[0.03] text-[12px] uppercase tracking-wider text-paper/45">
          <tr>
            {head.map((h, i) => (
              <th key={`${h}-${i}`} className="whitespace-nowrap px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06] text-paper/80">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, mono = false, dim = false, className = "" }: { children: React.ReactNode; mono?: boolean; dim?: boolean; className?: string }) {
  return <td className={`px-4 py-3 align-top ${mono ? "font-mono text-[13px]" : ""} ${dim ? "text-paper/50" : ""} ${className}`}>{children}</td>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-[14px] text-paper/45">{children}</p>;
}

const STATE_STYLE: Record<AccessState, string> = {
  trial: "border-accent/30 bg-accent/10 text-accent",
  active: "border-mint/25 bg-mint/10 text-mint",
  comped: "border-mint/25 bg-mint/10 text-mint",
  past_due: "border-amber/30 bg-amber/10 text-amber",
  expired: "border-white/15 bg-white/5 text-paper/55",
  canceled: "border-white/15 bg-white/5 text-paper/55",
  suspended: "border-red-500/30 bg-red-500/10 text-red-300",
};

export function StateBadge({ state }: { state: AccessState }) {
  return <span className={`inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${STATE_STYLE[state]}`}>{state.replace("_", " ")}</span>;
}

export function Pill({ children, tone = "dim" }: { children: React.ReactNode; tone?: "mint" | "amber" | "rose" | "dim" }) {
  const styles = {
    mint: "border-mint/25 bg-mint/10 text-mint",
    amber: "border-amber/30 bg-amber/10 text-amber",
    rose: "border-red-500/30 bg-red-500/10 text-red-300",
    dim: "border-white/12 bg-white/[0.04] text-paper/60",
  }[tone];
  return <span className={`inline-block border px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wider ${styles}`}>{children}</span>;
}

export function ago(date: Date | null | undefined): string {
  if (!date) return "never";
  const s = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86_400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86_400)}d ago`;
}

export function day(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

export function UserLink({ id, email }: { id: string; email: string }) {
  return (
    <Link href={`/admin/users/${id}`} className="text-paper hover:text-accent">
      {email}
    </Link>
  );
}
