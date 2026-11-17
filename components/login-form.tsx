"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    window.setTimeout(() => {
      router.push("/dashboard");
    }, 450);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <label htmlFor="login-email" className="mb-1.5 block text-[12px] font-medium text-ink/60">
        Work email
      </label>
      <input
        id="login-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@store.com"
        className="h-11 w-full rounded-lg border border-ink/15 bg-white/70 px-3 text-[14px] text-ink outline-none transition placeholder:text-ink/25 focus:border-accent/60 focus:bg-white"
      />
      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary mt-3 w-full disabled:cursor-wait disabled:opacity-70"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Opening workspace
          </>
        ) : (
          <>
            Continue with email
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
