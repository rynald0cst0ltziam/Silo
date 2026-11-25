import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { PricingCards, StoreIsolationNote } from "@/components/pricing-cards";
import { PlanLimitsTable } from "@/components/plan-limits-table";
import { FaqList } from "@/components/faq";
import { CtaBand } from "@/components/cta-band";
import { ConnectButton } from "@/components/connect/connect-button";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Silo pricing for WooCommerce stores. One, three or five isolated stores from $29/month. Unlimited products, full surgical invalidation, 3-day trial with no card.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Silo pricing — per store, not per panic",
    description:
      "1, 3 or 5 isolated stores. Unlimited products. The full invalidation engine on every plan.",
    url: "/pricing",
  },
};

const INCLUDED = [
  "Unlimited products and variations",
  "Full surgical invalidation engine",
  "Automatic category and tag mapping",
  "Variation-level stock invalidation",
  "HPOS order and refund events",
  "Store API filter mapping",
  "Priority warmup queue, desktop and mobile",
  "Currency, language and geo-aware cache keys",
  "Works alongside your cache plugin, host and Cloudflare",
  "Elementor and page builder support",
  "Cart, checkout and account bypass",
  "Fails closed: never serves a stale page",
  "Per-store keys and cache namespaces",
  "Connector updates for the life of the plan",
  "Invalidation log, CSV exports and account activity log",
  "Human support from the team that built it",
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-accent/12 blur-[130px]" />
        <div className="container-page relative pb-12 pt-10 sm:pt-14">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="eyebrow justify-center text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              Pricing
            </p>
            <h1 className="display mt-5 text-[clamp(34px,4.6vw,54px)] text-paper">
              One price per store.
              <br />
              <span className="text-paper/38">Correct stock included.</span>
            </h1>
            <p className="lede mx-auto mt-6 max-w-[540px]">
              Every plan gets the full invalidation engine. The only difference is how many
              stores you run, how many events you log, and how fast you want priority pages
              re-warmed.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11.5px] text-paper/40">
              {["3-day trial", "No card required", "Cancel anytime"].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-mint/70" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page pb-16 pt-12">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 pb-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
              Plans / per account
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/35">
              USD · monthly or annual
            </p>
          </div>
          <PricingCards />
          <StoreIsolationNote />
          <div className="mt-14">
            <h2 className="display-tight text-[clamp(24px,2.8vw,32px)] text-ink">Every limit, in one place.</h2>
            <p className="mt-2 max-w-[620px] text-[15px] leading-relaxed text-ink/55">
              The same numbers the service enforces. Upgrades apply instantly, including to warmup.
            </p>
            <div className="mt-6">
              <PlanLimitsTable />
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper bg-paper-2">
        <div className="container-page py-16">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                In every plan
              </p>
              <h2 className="display-tight mt-4 max-w-[380px] text-[clamp(26px,3.2vw,36px)] text-ink">
                No correctness tier.
              </h2>
              <p className="lede-dark mt-4 max-w-[370px] text-[15px]">
                We don&apos;t hold stock accuracy back for an enterprise plan. If Silo is doing
                the job, it is doing all of it.
              </p>
              <div className="mt-6 flex items-center gap-2 text-[11.5px] text-ink/40">
                <ShieldCheck className="h-3.5 w-3.5" />
                Every store gets its own key and namespace.
              </div>
            </div>

            <ul className="grid gap-x-8 gap-y-3.5 sm:grid-cols-2">
              {INCLUDED.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-deep" />
                  <span className="text-[13px] leading-snug text-ink/60">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="surface-paper" id="faq">
        <div className="container-page section">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
            <div className="self-start lg:sticky lg:top-32">
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                Objections
              </p>
              <h2 className="display-tight mt-5 max-w-[420px] text-[clamp(26px,3.4vw,38px)] text-ink">
                The questions you should ask a cache.
              </h2>
              <p className="lede-dark mt-4 max-w-[360px] text-[15px]">
                Short, direct answers. If yours isn&apos;t here, the docs go deeper — or email a
                human.
              </p>

              <div className="mt-7 rounded-xl border border-ink/10 bg-white/50 p-4">
                <p className="text-[12px] font-medium text-ink">Still evaluating?</p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink/45">
                  We&apos;ll look at your catalog structure and tell you honestly whether Silo
                  fits.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="mailto:rynaldostoltz85@gmail.com" className="btn btn-outline-dark btn-sm">
                    Email the team
                  </a>
                  <Link href="/docs" className="btn btn-outline-dark btn-sm">
                    Read the docs
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <FaqList />
              <div className="mt-8 flex flex-col items-start justify-between gap-3 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3.5 sm:flex-row sm:items-center">
                <p className="text-[12px] text-ink/50">
                  Prefer to see it first? The demo dashboard uses a sample catalog.
                </p>
                <Link href="/dashboard" className="link-arrow shrink-0 text-[12px]">
                  Open the demo
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper bg-paper-2">
        <div className="container-page pb-16">
          <div className="flex flex-col items-center justify-between gap-5 rounded-2xl border border-ink/10 bg-white/55 p-6 text-center sm:flex-row sm:text-left">
            <div>
              <p className="text-[15px] font-medium text-ink">Checkout for a specific store?</p>
              <p className="mt-1 text-[12.5px] text-ink/45">
                Start the trial and we&apos;ll scope the connector to that store only.
              </p>
            </div>
            <ConnectButton>Connect your store</ConnectButton>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
