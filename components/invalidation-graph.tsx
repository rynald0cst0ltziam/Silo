import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileJson,
  LayoutGrid,
  Lock,
  Package,
  Radio,
} from "lucide-react";

const NODES = [
  {
    icon: Package,
    label: "Product page",
    detail: "/product/aster-linen-shirt",
    note: "stock summary + schema",
  },
  {
    icon: LayoutGrid,
    label: "Categories",
    detail: "/category/shirts · /category/new",
    note: "2 archives contain it",
  },
  {
    icon: Radio,
    label: "Store API",
    detail: "/products?category=shirts",
    note: "1 cached filter set",
  },
];

export function InvalidationGraph({ compact = false }: { compact?: boolean }) {
  return (
    <section className="relative overflow-hidden border-y border-white/8 bg-[#090b0e]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-25" />
      <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[420px] rounded-full bg-accent/10 blur-[120px]" />
      <div className={`container-page relative ${compact ? "section-sm" : "section"}`}>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              The invalidation graph
            </p>
            <h2 className="display-tight mt-5 text-[clamp(28px,3.4vw,42px)] text-paper">
              One stock change.
              <br />
              <span className="text-paper/35">Five precise decisions.</span>
            </h2>
            <p className="lede mt-6 max-w-[440px]">
              When a variation sells out, Silo does not clear the store. It walks the graph from
              that variation to every response that could now be wrong — then stops.
            </p>

            <div className="mt-7 space-y-3">
              {[
                "Product, variation payload and schema markup",
                "Only the category and tag archives that contain it",
                "Only Store API filter combinations already cached",
                "Cart, checkout and account never enter the graph",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-[13px] text-paper/55">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-mint/80" />
                  {item}
                </div>
              ))}
            </div>

            <Link href="/how-it-works" className="link-arrow link-arrow-light group mt-8">
              Read the event flow
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-[#0c0f13] p-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] sm:p-4">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="pulse-dot h-1.5 w-1.5 shrink-0" />
                  <span className="truncate font-mono text-[9px] text-paper/55">
                    woocommerce_variation_stock_changed
                  </span>
                </div>
                <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] text-accent-hi">
                  42 ms
                </span>
              </div>

              <div className="mt-3 rounded-xl border border-accent/30 bg-accent/[0.07] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#26332b] font-mono text-[9px] text-paper/50">
                      <Package className="h-4 w-4 text-paper/50" />
                    </span>
                    <div>
                      <p className="text-[11.5px] font-medium text-paper/90">
                        Aster Linen Shirt
                      </p>
                      <p className="font-mono text-[8px] text-paper/35">
                        product:1042 · olive / m
                      </p>
                    </div>
                  </div>
                  <span className="rounded border border-rose/25 bg-rose/8 px-1.5 py-0.5 font-mono text-[8px] text-rose">
                    stock 6 → 0
                  </span>
                </div>
              </div>

              <div className="relative mx-auto h-7 w-px bg-gradient-to-b from-accent/60 to-white/15" />
              <div className="mx-8 h-px bg-white/12 md:mx-12" />

              <div className="mt-0 grid gap-2 sm:grid-cols-3">
                {NODES.map((node) => (
                  <div key={node.label} className="relative pt-3">
                    <span className="absolute left-1/2 top-0 hidden h-3 w-px -translate-x-1/2 bg-white/15 sm:block" />
                    <div className="rounded-lg border border-white/9 bg-white/[0.025] p-3">
                      <div className="flex items-center justify-between">
                        <node.icon className="h-3.5 w-3.5 text-accent-hi/80" />
                        <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-mint/70">
                          invalidated
                        </span>
                      </div>
                      <p className="mt-2 text-[10px] font-medium text-paper/80">{node.label}</p>
                      <p className="mt-0.5 truncate font-mono text-[7.5px] text-paper/30">
                        {node.detail}
                      </p>
                      <p className="mt-1.5 border-t border-white/7 pt-1.5 font-mono text-[7px] text-paper/25">
                        {node.note}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-2 border-t border-white/8 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 font-mono text-[8px] text-paper/35">
                  <span>5 URLs</span>
                  <span>2 categories</span>
                  <span>1 API route</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[8px] text-mint/60">
                  <Lock className="h-2.5 w-2.5" />
                  1,279 nodes untouched
                </div>
              </div>
            </div>

            <div className="float-slow absolute -bottom-4 -right-2 hidden items-center gap-2 rounded-lg border border-white/12 bg-[#10141a] px-3 py-2 shadow-xl sm:flex">
              <FileJson className="h-3 w-3 text-amber/80" />
              <span className="font-mono text-[8px] text-paper/45">
                variation payload re-warmed
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
