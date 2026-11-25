import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConnectButton } from "@/components/connect/connect-button";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d11] px-6 py-14 sm:px-12 sm:py-16">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-35 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
          <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-[520px] -translate-x-1/2 rounded-full bg-accent/20 blur-[100px]" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -bottom-8 select-none font-display text-[160px] font-semibold leading-none tracking-[-0.07em] text-white/[0.025] sm:text-[220px]"
          >
            silo
          </div>

          <div className="relative mx-auto max-w-[700px] text-center">
            <p className="eyebrow justify-center text-accent-hi">
              <span className="pulse-dot" />
              Start with one store
            </p>
            <h2 className="display-tight mt-5 text-[clamp(30px,4vw,48px)] text-paper">
              The catalog stays warm.
              <br />
              <span className="text-paper/40">The stock stays true.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-[490px] text-[15px] leading-relaxed text-paper/50">
              Install the connector, change one variation&apos;s stock and watch Silo clear
              exactly the pages it touched, rewarm them, and log why. No other page is touched,
              and your existing cache stays.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ConnectButton size="lg">
                Connect your store
                <ArrowRight className="h-4 w-4" />
              </ConnectButton>
              <Link href="/docs" className="btn btn-secondary btn-lg">
                Read the docs
              </Link>
            </div>

            <p className="mt-5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-paper/25">
              3-day trial · no card · WooCommerce 8.2+ · HPOS ready
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
