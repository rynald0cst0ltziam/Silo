import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Info, ShieldCheck, Zap } from "lucide-react";
import { Logo } from "@/components/logo";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Silo workspace.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="grid min-h-[calc(100dvh-61px)] lg:grid-cols-[1.02fr_0.98fr]">
      <section className="relative hidden overflow-hidden border-r border-white/8 bg-ink p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_30%_20%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-[380px] w-[380px] rounded-full bg-accent/15 blur-[110px]" />

        <div className="relative">
          <p className="eyebrow text-accent-hi">
            <span className="h-px w-6 bg-accent-hi" />
            Silo workspace
          </p>
          <h1 className="display-tight mt-6 max-w-[470px] text-[clamp(34px,3.6vw,44px)] text-paper">
            Your stock is exactly
            <br />
            where you left it.
          </h1>
          <p className="mt-5 max-w-[400px] text-[14px] leading-relaxed text-paper/45">
            Every invalidation, every warmup, every store — in one place. No guessing which
            plugin fired, or which page is still holding an old price.
          </p>
        </div>

        <div className="relative my-10 max-w-[400px] rounded-xl border border-white/10 bg-white/[0.025] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/12 ring-1 ring-accent/20">
                <Zap className="h-3 w-3 text-accent-hi" />
              </span>
              <span className="font-mono text-[9px] text-paper/60">stock.changed</span>
            </div>
            <span className="font-mono text-[8px] text-mint/70">42ms</span>
          </div>
          <p className="mt-3 font-mono text-[8.5px] leading-relaxed text-paper/30">
            product:1042 · olive / m · stock 6 → 0
            <br />
            invalidated 3 URLs · 2 categories · 1 API route
          </p>
          <div className="mt-3 space-y-1.5 border-t border-white/8 pt-3">
            {["Cart and checkout bypassed", "2 priority pages re-warming"].map((item) => (
              <p key={item} className="flex items-center gap-2 text-[10px] text-paper/40">
                <Check className="h-3 w-3 text-mint/70" />
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-6 border-t border-white/8 pt-6">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-paper/30">
            <span className="pulse-dot" />
            Edge healthy · 5 regions
          </div>
          <div className="flex items-center gap-2 text-[10px] text-paper/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            Store keys are scoped
          </div>
        </div>
      </section>

      <section className="surface-paper flex items-center justify-center px-6 py-16 sm:px-10 sm:py-20">
        <div className="w-full max-w-[372px]">
          <Logo onDark={false} />

          <h2 className="display-tight mt-10 text-[34px] text-ink">Sign in to Silo</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink/45">
            Use the email tied to your store account. We&apos;ll open your workspace.
          </p>

          <LoginForm />

          <div className="mt-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink/25">or</span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <Link href="/dashboard" className="btn btn-outline-dark mt-6 w-full">
            Explore the demo workspace
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>

          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-ink/10 bg-white/45 p-3">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
            <p className="text-[10.5px] leading-relaxed text-ink/40">
              This is a preview build. Authentication isn&apos;t connected yet — the form opens
              the sample workspace with static demo data.
            </p>
          </div>

          <p className="mt-6 text-center text-[11.5px] text-ink/40">
            New to Silo?{" "}
            <Link href="/pricing" className="font-medium text-ink underline underline-offset-2">
              Start a 14-day trial
            </Link>
          </p>
          <p className="mt-4 text-center text-[10px] text-ink/25">
            By signing in you agree to the{" "}
            <Link href="/terms" className="underline underline-offset-2">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
