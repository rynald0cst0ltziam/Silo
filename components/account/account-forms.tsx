"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Loader2 } from "lucide-react";

const input =
  "h-11 w-full border border-white/12 bg-white/[0.03] px-3 text-[15px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]";
const label = "mb-1.5 block text-[13px] font-medium text-paper/60";
const primary =
  "inline-flex h-10 items-center justify-center gap-2 bg-accent px-4 text-[14px] font-medium text-white transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70";
const secondary =
  "inline-flex h-10 items-center justify-center gap-2 bg-white/[0.07] px-4 text-[14px] font-medium text-paper transition hover:bg-white/[0.12] disabled:opacity-60";

type Note = { kind: "ok" | "error"; text: string } | null;

function Message({ note }: { note: Note }) {
  if (!note) return null;
  return (
    <p
      role={note.kind === "error" ? "alert" : "status"}
      className={note.kind === "error" ? "text-[14px] text-red-300" : "text-[14px] text-mint"}
    >
      {note.text}
    </p>
  );
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Network error. Try again." } as const;
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return res.ok ? ({ ok: true } as const) : ({ ok: false, error: data.error ?? `Request failed (${res.status})` } as const);
}

export function ProfileForm({ name: initialName, email: initialEmail }: { name: string; email: string }) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);
  const emailChanged = email.trim().toLowerCase() !== initialEmail;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await send("/api/account", "PATCH", { name, email, password: emailChanged ? password : undefined });
    setBusy(false);
    setPassword("");
    setNote(result.ok ? { kind: "ok", text: "Saved." } : { kind: "error", text: result.error });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="acct-name" className={label}>Name</label>
          <input id="acct-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="acct-email" className={label}>Email</label>
          <input id="acct-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
        </div>
      </div>
      {emailChanged ? (
        <div className="sm:max-w-[50%]">
          <label htmlFor="acct-email-pass" className={label}>Current password (required to change email)</label>
          <input id="acct-email-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} autoComplete="current-password" />
        </div>
      ) : null}
      <div className="flex items-center gap-4">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save profile
        </button>
        <Message note={note} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const result = await send("/api/account/password", "POST", { current, next });
    if (result.ok) {
      setNote({ kind: "ok", text: "Password changed. Signing you out of every browser…" });
      setTimeout(() => signOut({ redirect: false }).then(() => window.location.assign("/sign-in")), 1200);
      return;
    }
    setBusy(false);
    setNote({ kind: "error", text: result.error });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pw-current" className={label}>Current password</label>
          <input id="pw-current" type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={input} autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="pw-next" className={label}>New password</label>
          <input id="pw-next" type="password" required minLength={8} maxLength={200} value={next} onChange={(e) => setNext(e.target.value)} className={input} autoComplete="new-password" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button type="submit" disabled={busy} className={primary}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Change password
        </button>
        <Message note={note} />
      </div>
    </form>
  );
}

export function SignOutEverywhere() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      className={secondary}
      onClick={async () => {
        setBusy(true);
        await send("/api/account/signout-all", "POST");
        signOut({ redirect: false }).then(() => window.location.assign("/sign-in"));
      }}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      Sign out of every browser
    </button>
  );
}

export function DeleteAccount({ storeCount, hasSubscription }: { storeCount: number; hasSubscription: boolean }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center border border-red-500/40 px-4 text-[14px] font-medium text-red-300 transition hover:bg-red-500/10">
        Delete account…
      </button>
    );
  }

  return (
    <form
      className="space-y-4 border border-red-500/30 bg-red-500/[0.05] p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const result = await send("/api/account", "DELETE", { password, confirm });
        if (result.ok) {
          signOut({ redirect: false }).then(() => window.location.assign("/"));
          return;
        }
        setBusy(false);
        setNote({ kind: "error", text: result.error });
      }}
    >
      <p className="text-[14px] leading-relaxed text-paper/85">
        This permanently deletes your Silo account{storeCount ? `, ${storeCount} connected store${storeCount === 1 ? "" : "s"}` : ""}, their logs and statistics.
        {hasSubscription ? " Your subscription is canceled immediately with no further charges." : ""} Connected stores stop serving Silo&apos;s cache at their next check-in. This cannot be undone.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="del-pass" className={label}>Current password</label>
          <input id="del-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={input} autoComplete="current-password" />
        </div>
        <div>
          <label htmlFor="del-confirm" className={label}>Type DELETE to confirm</label>
          <input id="del-confirm" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} autoComplete="off" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={busy || confirm !== "DELETE"} className="inline-flex h-10 items-center gap-2 bg-red-500 px-4 text-[14px] font-medium text-white transition hover:bg-red-500/90 disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Permanently delete
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondary}>Cancel</button>
        <Message note={note} />
      </div>
    </form>
  );
}
