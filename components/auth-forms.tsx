"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { safeNext } from "@/lib/plan-intent";

/** Where to go after signing in or up: ?next= or ?callbackUrl= (same-site only), else the dashboard. */
function nextTarget(): string {
  const params = new URLSearchParams(window.location.search);
  return safeNext(params.get("next")) ?? safeNext(params.get("callbackUrl")) ?? "/dashboard";
}

/** Keeps ?next= when switching between sign-in and sign-up. */
function useCarriedSearch(): string {
  const [search, setSearch] = useState("");
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next") ?? new URLSearchParams(window.location.search).get("callbackUrl");
    setSearch(safeNext(next) ? `?next=${encodeURIComponent(next as string)}` : "");
  }, []);
  return search;
}

export function SignInForm() {
  const carried = useCarriedSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    window.location.href = nextTarget();
  }

  return (
    <div className="w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#0b0d11] p-7">
      <div className="flex justify-center">
        <Logo className="h-6 w-auto" />
      </div>
      <h1 className="mt-5 text-center text-[18px] font-semibold text-paper">
        Sign in to Silo
      </h1>
      <p className="mt-1 text-center text-[12px] text-paper/40">
        Enter your credentials to access your dashboard.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="signin-email" className="mb-1.5 block text-[12px] font-medium text-paper/60">
            Email
          </label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
          />
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-[13px] font-medium text-paper/60">
              Password
            </label>
            <Link href="/forgot-password" className="text-[13px] text-accent/80 hover:text-accent">
              Forgot password?
            </Link>
          </div>
          <input
            id="signin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-medium text-white transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>
      </form>

      <p className="mt-5 text-center text-[11px] text-paper/30">
        No account?{" "}
        <Link href={`/sign-up${carried}`} className="text-accent/70 underline underline-offset-2 hover:text-accent">
          Create one
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const carried = useCarriedSearch();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Account created but sign-in failed. Try signing in manually.");
      setLoading(false);
      return;
    }

    window.location.href = nextTarget();
  }

  return (
    <div className="w-full max-w-[380px] rounded-2xl border border-white/10 bg-[#0b0d11] p-7">
      <div className="flex justify-center">
        <Logo className="h-6 w-auto" />
      </div>
      <h1 className="mt-5 text-center text-[18px] font-semibold text-paper">
        Create your account
      </h1>
      <p className="mt-1 text-center text-[12px] text-paper/40">
        7-day free trial. No card required.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="signup-name" className="mb-1.5 block text-[12px] font-medium text-paper/60">
            Name
          </label>
          <input
            id="signup-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="Your name"
            className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
          />
        </div>
        <div>
          <label htmlFor="signup-email" className="mb-1.5 block text-[12px] font-medium text-paper/60">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
          />
        </div>
        <div>
          <label htmlFor="signup-password" className="mb-1.5 block text-[12px] font-medium text-paper/60">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
            placeholder="At least 8 characters"
            className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 text-[14px] text-paper outline-none transition placeholder:text-paper/25 focus:border-accent/60 focus:bg-white/[0.05]"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-[12px] text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[13px] font-medium text-white transition hover:bg-accent/90 disabled:cursor-wait disabled:opacity-70"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Start free trial
        </button>
      </form>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-paper/25">
        By signing up you agree to the{" "}
        <Link href="/terms" className="underline underline-offset-2 hover:text-paper/50">terms</Link>
        {" "}and{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-paper/50">privacy policy</Link>.
      </p>

      <p className="mt-3 text-center text-[11px] text-paper/30">
        Already have an account?{" "}
        <Link href={`/sign-in${carried}`} className="text-accent/70 underline underline-offset-2 hover:text-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
