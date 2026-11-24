"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";

const input =
  "h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[15px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]";
const button =
  "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[14px] font-medium text-white transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70";

function Shell({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-2xl border border-white/10 bg-[#0b0d11] p-7">
      <div className="flex justify-center">
        <Logo className="h-6 w-auto" />
      </div>
      <h1 className="mt-5 text-center text-[20px] font-semibold text-paper">{title}</h1>
      <p className="mt-1.5 text-center text-[14px] text-paper/50">{intro}</p>
      {children}
      <p className="mt-5 text-center text-[13px] text-paper/40">
        <Link href="/sign-in" className="text-accent/80 underline underline-offset-2 hover:text-accent">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    const res = await fetch("/api/account/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    if (!res) {
      setError("Network error. Try again.");
      setState("idle");
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Something went wrong. Try again.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <Shell title="Reset your password" intro="Enter your account email and we will send a reset link.">
      {state === "sent" ? (
        <p className="mt-6 rounded-lg border border-mint/25 bg-mint/[0.07] px-3 py-3 text-[14px] text-paper/85" role="status">
          If an account exists for {email}, a reset link is on its way. It works once and expires in one hour.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="forgot-email" className="mb-1.5 block text-[13px] font-medium text-paper/60">
              Email
            </label>
            <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
          </div>
          {error ? <p className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5 text-[13px] text-red-300">{error}</p> : null}
          <button type="submit" disabled={state === "busy"} className={button}>
            {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send reset link
          </button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setState("busy");
    setError("");
    const res = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : { error: "Network error. Try again." };
    if (!res?.ok) {
      setError(data.error ?? "Something went wrong. Try again.");
      setState("idle");
      return;
    }
    setState("done");
  }

  if (!token) {
    return (
      <Shell title="Link not valid" intro="This reset link is incomplete.">
        <p className="mt-6 text-center text-[14px]">
          <Link href="/forgot-password" className="text-accent underline underline-offset-2">
            Request a new link
          </Link>
        </p>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" intro="At least 8 characters. Every signed-in browser will be signed out.">
      {state === "done" ? (
        <div className="mt-6 space-y-4">
          <p className="rounded-lg border border-mint/25 bg-mint/[0.07] px-3 py-3 text-[14px] text-paper/85" role="status">
            Password updated. Sign in with the new password.
          </p>
          <Link href="/sign-in" className={button}>
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-password" className="mb-1.5 block text-[13px] font-medium text-paper/60">
              New password
            </label>
            <input id="reset-password" type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
          </div>
          <div>
            <label htmlFor="reset-confirm" className="mb-1.5 block text-[13px] font-medium text-paper/60">
              Repeat new password
            </label>
            <input id="reset-confirm" type="password" required minLength={8} maxLength={200} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          </div>
          {error ? <p className="rounded-lg border border-red-500/25 bg-red-500/[0.08] px-3 py-2.5 text-[13px] text-red-300">{error}</p> : null}
          <button type="submit" disabled={state === "busy"} className={button}>
            {state === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save new password
          </button>
        </form>
      )}
    </Shell>
  );
}
