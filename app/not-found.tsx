import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="relative overflow-hidden bg-ink">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="container-page flex min-h-[62vh] flex-col items-center justify-center py-20 text-center">
        <div className="w-full max-w-[300px] rounded-xl border border-white/10 bg-[#0b0d11] p-4 text-left">
          <div className="flex items-center justify-between font-mono text-[8px]">
            <span className="text-paper/30">GET /this-page</span>
            <span className="rounded border border-amber/25 bg-amber/8 px-1.5 py-0.5 text-amber">
              404
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/8 pt-3 font-mono text-[9px]">
            <span className="text-paper/55">x-silo-cache</span>
            <span className="text-paper/30">MISS</span>
          </div>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/6">
            <div className="h-full w-[6%] rounded-full bg-accent/70" />
          </div>
          <p className="mt-2 font-mono text-[7.5px] text-paper/20">
            no cached node to re-warm
          </p>
        </div>

        <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-hi">
          404 · cache miss
        </p>
        <h1 className="display mt-4 text-[clamp(34px,4.4vw,46px)] text-paper">
          This page was never warmed.
        </h1>
        <p className="lede mt-4 max-w-[420px]">
          The URL doesn&apos;t exist. Unlike your stock, that is at least consistent.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="btn btn-primary">
            Back to the catalog
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/docs" className="btn btn-secondary">
            Read the docs
          </Link>
        </div>
      </div>
    </div>
  );
}
