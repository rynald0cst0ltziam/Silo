import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Globe2,
  Layers,
  LockKeyhole,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";

const FEATURES = [
  {
    icon: Layers,
    title: "Surgical invalidation",
    body: "Silo knows every category, tag and attribute archive that contains a product. A change purges the product, the archives it actually belongs to, and nothing else.",
    chips: ["product → categories", "graph-walk", "no full purge"],
    span: true,
    visual: "graph",
  },
  {
    icon: Boxes,
    title: "Inventory-aware",
    body: "Listens to stock reductions, order events, refunds and manual edits — through HPOS or legacy postmeta. The variation node is the source of truth.",
    chips: ["HPOS", "refunds", "backorders"],
  },
  {
    icon: Sparkles,
    title: "Variant handling",
    body: "Diffs the variation matrix cell by cell. One size selling out does not purge 23 unchanged variations, and the dropdown payload never lies.",
    chips: ["4 colors × 6 sizes", "per-cell diff"],
  },
  {
    icon: Zap,
    title: "Priority warmup",
    body: "After invalidation, Silo re-warms the pages that matter first: high-revenue products, entry pages, and the archives shoppers actually land on.",
    chips: ["revenue-ranked", "entry pages"],
  },
  {
    icon: Globe2,
    title: "Currency, language, geo",
    body: "One catalog, many responses. Silo keys product renderings by currency, locale and tax display, and invalidates only the keys that exist.",
    chips: ["6 currencies", "locale-aware"],
  },
  {
    icon: Radio,
    title: "Store API & Blocks",
    body: "Maps product collection routes and their filters. A stock change invalidates the cached filter combinations that can contain that product.",
    chips: ["/products", "filters", "Blocks"],
  },
];

export function Features() {
  return (
    <section className="surface-paper relative overflow-hidden">
      <div className="container-page section">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow text-accent-deep">
              <span className="h-px w-6 bg-accent-deep" />
              The engine
            </p>
            <h2 className="display-tight mt-5 max-w-[680px] text-[clamp(28px,3.6vw,44px)] text-ink">
              Built around products, variants, stock and orders.
            </h2>
          </div>
          <p className="lede-dark max-w-[390px]">
            No all-in-one performance suite. No twenty settings tabs. One narrow product that
            does the hard part correctly, and gets out of the way.
          </p>
        </div>

        <div className="mt-12 grid gap-3.5 md:grid-cols-3">
          <article className="relative overflow-hidden rounded-2xl border border-ink/10 bg-white/55 p-6 md:col-span-2">
            <div className="flex items-start justify-between gap-6">
              <div className="max-w-[430px]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/[0.07]">
                  <Layers className="h-4 w-4 text-accent-deep" />
                </span>
                <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.025em] text-ink">
                  Surgical invalidation
                </h3>
                <p className="mt-2 text-[13.5px] leading-[1.65] text-ink/55">
                  Silo knows every category, tag and attribute archive that contains a product.
                  A change purges the product, the archives it actually belongs to, and nothing
                  else.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {["product → categories", "graph-walk", "no full purge"].map((chip) => (
                    <span key={chip} className="chip chip-dark">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="hidden w-[200px] shrink-0 rounded-lg border border-ink/10 bg-ink p-3 sm:block">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-paper/30">
                  graph walk
                </p>
                <div className="mt-2 rounded border border-accent/25 bg-accent/10 px-2 py-1.5 font-mono text-[8px] text-accent-hi">
                  product:1042
                </div>
                <div className="mx-auto h-3 w-px bg-white/15" />
                <div className="grid grid-cols-3 gap-1 border-t border-white/10 pt-2">
                  {["page", "category", "API"].map((node) => (
                    <div
                      key={node}
                      className="rounded border border-white/8 bg-white/[0.02] px-1 py-1.5 text-center font-mono text-[7px] text-paper/45"
                    >
                      {node}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-white/8 pt-2 font-mono text-[7px]">
                  <span className="text-paper/25">untouched</span>
                  <span className="text-mint/70">1,279</span>
                </div>
              </div>
            </div>
          </article>

          {FEATURES.slice(1).map((feature) => (
            <article
              key={feature.title}
              className="group rounded-2xl border border-ink/10 bg-white/55 p-6 transition-colors duration-300 hover:bg-white/80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/10 bg-white/70">
                <feature.icon className="h-4 w-4 text-ink/70" strokeWidth={1.7} />
              </span>
              <h3 className="mt-5 text-[16.5px] font-semibold tracking-[-0.02em] text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-ink/55">{feature.body}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {feature.chips.map((chip) => (
                  <span key={chip} className="chip chip-dark">
                    {chip}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-ink/10 bg-white/60 px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-mint-deep/20 bg-mint/10">
                <LockKeyhole className="h-4 w-4 text-mint-deep" />
              </span>
              <div>
                <h3 className="text-[16.5px] font-semibold tracking-[-0.02em] text-ink">
                  Cart, checkout and account requests are never cached.
                </h3>
                <p className="mt-1.5 max-w-[650px] text-[13px] leading-relaxed text-ink/55">
                  Session cookies, cart tokens, nonces and authenticated users are forwarded at
                  your server before a cache key exists. Zero exclusions to maintain. Zero cart
                  state in shared storage.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["session cookies", "cart tokens", "authenticated users"].map((item) => (
                    <span key={item} className="chip chip-dark">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <Link href="/how-it-works" className="link-arrow group shrink-0 text-[13px]">
              The safety boundary
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
