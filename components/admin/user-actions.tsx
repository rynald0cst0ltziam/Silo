"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type Props = {
  id: string;
  email: string;
  self: boolean;
  role: string;
  suspended: boolean;
  planOverride: string | null;
  state: string;
};

const btn = "inline-flex h-9 items-center gap-2 bg-white/[0.07] px-3 text-[13px] font-medium text-paper transition hover:bg-white/[0.12] disabled:opacity-50";
const input = "h-9 border border-white/12 bg-white/[0.03] px-2.5 text-[13px] text-paper outline-none focus:border-accent/60";

export function UserActions({ id, email, self, role, suspended, planOverride, state }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [days, setDays] = useState(14);
  const [plan, setPlan] = useState(planOverride ?? "");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  async function run(action: string, extra: Record<string, unknown> = {}, done = "Saved") {
    setBusy(action);
    setNote(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string; deleted?: boolean }) : { error: "Network error" };
    setBusy(null);
    if (!res?.ok) {
      setNote({ ok: false, text: data.error ?? "Failed" });
      return;
    }
    if (data.deleted) {
      router.push("/admin/users");
      return;
    }
    setNote({ ok: true, text: done });
    router.refresh();
  }

  const spin = (a: string) => (busy === a ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null);

  return (
    <div className="space-y-5 p-4">
      {note ? <p className={`text-[14px] ${note.ok ? "text-mint" : "text-red-300"}`} role="status">{note.text}</p> : null}

      <div>
        <p className="text-[13px] font-medium text-paper/70">Free trial</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${input} w-20`} aria-label="Days" />
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("extend_trial", { days }, `Trial extended by ${days} days`)}>
            {spin("extend_trial")}Extend trial
          </button>
          {state === "trial" ? (
            <button type="button" className={btn} disabled={!!busy} onClick={() => run("end_trial", {}, "Trial ended")}>
              {spin("end_trial")}End trial now
            </button>
          ) : null}
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-paper/70">Complimentary plan</p>
        <p className="text-[12px] text-paper/45">Overrides billing: full access at this plan&apos;s limits, no charges.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className={input} aria-label="Plan">
            <option value="">None (use billing)</option>
            <option value="solo">Solo</option>
            <option value="studio">Studio</option>
            <option value="portfolio">Portfolio</option>
          </select>
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("set_plan", { plan: plan || null }, plan ? `Comped on ${plan}` : "Complimentary plan removed")}>
            {spin("set_plan")}Apply
          </button>
        </div>
      </div>

      <div>
        <p className="text-[13px] font-medium text-paper/70">Sessions and role</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={btn} disabled={!!busy} onClick={() => run("signout", {}, "Signed out everywhere")}>
            {spin("signout")}Sign out everywhere
          </button>
          {!self ? (
            <button type="button" className={btn} disabled={!!busy} onClick={() => run("set_role", { role: role === "admin" ? "user" : "admin" }, role === "admin" ? "Admin role removed" : "Made admin")}>
              {spin("set_role")}{role === "admin" ? "Remove admin role" : "Make admin"}
            </button>
          ) : null}
        </div>
      </div>

      {!self ? (
        <div>
          <p className="text-[13px] font-medium text-paper/70">Suspension</p>
          <p className="text-[12px] text-paper/45">Suspended accounts are signed out and every connected store stops serving Silo&apos;s cache (fail closed).</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {suspended ? (
              <button type="button" className={btn} disabled={!!busy} onClick={() => run("unsuspend", {}, "Suspension lifted")}>
                {spin("unsuspend")}Lift suspension
              </button>
            ) : (
              <>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (shown to the customer)" className={`${input} w-72`} />
                <button type="button" className="inline-flex h-9 items-center gap-2 border border-amber/40 px-3 text-[13px] font-medium text-amber hover:bg-amber/10 disabled:opacity-50" disabled={!!busy} onClick={() => run("suspend", { reason }, "Suspended")}>
                  {spin("suspend")}Suspend
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!self ? (
        <div className="border-t border-red-500/20 pt-4">
          <p className="text-[13px] font-medium text-red-300">Delete account</p>
          <p className="text-[12px] text-paper/45">Cancels the Stripe subscription immediately and deletes the account, its stores and history. Cannot be undone.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={`Type ${email}`} className={`${input} w-72`} autoComplete="off" />
            <button type="button" className="inline-flex h-9 items-center gap-2 bg-red-500 px-3 text-[13px] font-medium text-white hover:bg-red-500/90 disabled:opacity-50" disabled={!!busy || confirm.trim().toLowerCase() !== email} onClick={() => run("delete", { confirm })}>
              {spin("delete")}Delete permanently
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
