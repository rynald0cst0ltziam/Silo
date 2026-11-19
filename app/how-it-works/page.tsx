import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  FileWarning,
  Radio,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  UserRound,
} from "lucide-react";
import { ConnectButton } from "@/components/connect/connect-button";
import { HowSteps } from "@/components/how-steps";
import { InvalidationGraph } from "@/components/invalidation-graph";
import { DashboardSection } from "@/components/dashboard-section";
import { CtaBand } from "@/components/cta-band";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Inside Silo: the catalog scan, the invalidation graph, the WooCommerce event flow after a stock change, and the boundary that keeps carts out of cache.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How Silo works — the WooCommerce invalidation graph",
    description:
      "Scan the catalog, map products to variations and archives, then invalidate exactly what changed.",
    url: "/how-it-works",
  },
};

const TRACE = [
  { time: "0ms", event: "woocommerce_reduce_order_stock", state: "received" },
  { time: "+6ms", event: "graph.load(product:1042)", state: "ok" },
  { time: "+13ms", event: "invalidate(3 urls, 2 categories)", state: "ok" },
  { time: "+21ms", event: "invalidate(1 store-api filter set)", state: "ok" },
  { time: "+28ms", event: "warm.queue(2 priority urls)", state: "queued" },
  { time: "+42ms", event: "event.log(written)", state: "complete" },
];

const GRAPH_STATS = [
  { value: "4,218", label: "products mapped" },
  { value: "11,904", label: "variation nodes" },
  { value: "32", label: "archives resolved" },
  { value: "96", label: "cached API filter sets" },
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-accent/10 blur-[140px]" />
        <div className="container-page relative pb-12 pt-10 sm:pt-14">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_0.92fr]">
            <div>
              <p className="eyebrow text-accent-hi">
                <span className="h-px w-6 bg-accent-hi" />
                Product · How it works
              </p>
              <h1 className="display mt-5 max-w-[620px] text-[clamp(34px,4.6vw,54px)] text-paper">
                A cache that can
                <br />
                <span className="text-accent-hi">explain itself.</span>
              </h1>
              <p className="lede mt-6 max-w-[500px]">
                Silo is not a faster crawler bolted onto a page cache. It builds a catalog graph
                at scan time, then uses WooCommerce events to invalidate nodes of that graph —
                the product, its variations, the archives that contain it, and the Store API
                routes that depend on it.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <ConnectButton size="lg">
                  Connect your store
                  <ArrowRight className="h-4 w-4" />
                </ConnectButton>
                <Link href="/docs" className="btn btn-secondary btn-lg">
                  Read the docs
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="pointer-events-none absolute -inset-8 rounded-full bg-accent/12 blur-3xl" />
              <div className="relative rounded-xl border border-white/10 bg-[#0b0d11] p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="pulse-dot h-1.5 w-1.5" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-paper/45">
                      Live event trace
                    </span>
                  </div>
                  <span className="font-mono text-[8px] text-paper/25">store: aurora</span>
                </div>
                <div className="mt-3 space-y-2">
                  {TRACE.map((row) => (
                    <div
                      key={row.event}
                      className="flex items-center justify-between gap-3 font-mono text-[8.5px]"
                    >
                      <span className="w-8 shrink-0 text-paper/25">{row.time}</span>
                      <span className="flex-1 truncate text-paper/55">{row.event}</span>
                      <span
                        className={
                          row.state === "queued"
                            ? "text-amber/70"
                            : "text-mint/65"
                        }
                      >
                        {row.state}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-3">
                  <span className="font-mono text-[8px] text-paper/25">
                    1,279 catalog nodes untouched
                  </span>
                  <span className="rounded border border-accent/25 bg-accent/10 px-1.5 py-0.5 font-mono text-[8px] text-accent-hi">
                    total 42ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowSteps />

      <section className="surface-paper relative overflow-hidden">
        <div className="container-page section">
          <div className="grid gap-12 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                The scan
              </p>
              <h2 className="display-tight mt-5 max-w-[500px] text-[clamp(28px,3.4vw,42px)] text-ink">
                It builds a map,
                <span className="text-ink/32"> not a crawl.</span>
              </h2>
              <p className="lede-dark mt-5 max-w-[470px]">
                A warmup crawler guesses which URLs matter and hopes the template resolves them.
                Silo asks WooCommerce directly: which products exist, which variations belong to
                them, which terms are attached, and which Store API routes can return them.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Permalinks resolved at scan time, not inferred from a theme template.",
                  "Attribute terms become graph edges. Rename a term and every affected archive is re-mapped.",
                  "Store API filter combinations are enumerated deliberately — never replayed blindly.",
                  "Every heartbeat carries a graph version. Drift triggers a targeted re-scan.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink/55">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-deep" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-7 inline-flex items-center gap-2 rounded-lg border border-ink/10 bg-white/60 px-3 py-2 text-[11px] text-ink/45">
                <ScanLine className="h-3.5 w-3.5 text-ink/40" />
                A scan is not a warmup. Nothing is requested until caching is enabled.
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-ink/10 bg-[#0b0d11] p-5 text-paper shadow-[0_30px_70px_-35px_rgba(8,9,11,0.6)]">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-paper/30">
                    catalog graph · v42
                  </span>
                  <span className="rounded border border-mint/25 bg-mint/8 px-1.5 py-0.5 font-mono text-[7px] text-mint/75">
                    synced
                  </span>
                </div>
                <pre className="mt-4 overflow-x-auto font-mono text-[10px] leading-[1.9] text-paper/55">
{`product:1042  Aster Linen Shirt
├─ variation:olive/sm      in_stock
├─ variation:olive/md      out_of_stock  ← changed
├─ variation:olive/lg      in_stock
├─ variation:ecru/*        in_stock
├─ category:shirts         /category/shirts
├─ category:new            /category/new
├─ attribute:color         olive | ecru | ink
└─ store-api               /products?category=shirts
                           /products?stock=instock`}
                </pre>
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-3 sm:grid-cols-4">
                  {GRAPH_STATS.map((stat) => (
                    <div key={stat.label}>
                      <p className="font-display text-[16px] tracking-[-0.03em] text-paper/85">
                        {stat.value}
                      </p>
                      <p className="mt-0.5 font-mono text-[7px] leading-tight text-paper/25">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <InvalidationGraph />

      <section className="surface-paper">
        <div className="container-page section">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                The boundary
              </p>
              <h2 className="display-tight mt-5 max-w-[620px] text-[clamp(28px,3.6vw,42px)] text-ink">
                Session state never
                <span className="text-ink/32"> enters shared cache.</span>
              </h2>
            </div>
            <p className="lede-dark max-w-[410px]">
              Not a checkbox. Not an exclusion list someone forgets to update. The connector decides
              before a cache key exists.
            </p>
          </div>

          <div className="mt-11 grid gap-3.5 md:grid-cols-3">
            {[
              {
                icon: ShoppingCart,
                title: "Cart fragments",
                body: "Any request with a WooCommerce session cookie or cart token is forwarded untouched. No shared variant of the cart response exists.",
                signal: "session cookie",
              },
              {
                icon: ShieldAlert,
                title: "Checkout & nonces",
                body: "Nonce-bearing requests, cart POSTs and checkout endpoints bypass storage entirely. The cache never sees the payment flow.",
                signal: "nonce + cart token",
              },
              {
                icon: UserRound,
                title: "My account",
                body: "Authenticated users are private by definition. Order history, addresses and account pages are rendered live for that session.",
                signal: "authenticated",
              },
            ].map((card) => (
              <article key={card.title} className="rounded-2xl border border-ink/10 bg-white/55 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-ink/10 bg-white/70">
                    <card.icon className="h-4 w-4 text-ink/65" strokeWidth={1.7} />
                  </span>
                  <span className="rounded border border-ink/10 bg-ink/[0.03] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.06em] text-ink/35">
                    never cached
                  </span>
                </div>
                <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.02em] text-ink">
                  {card.title}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.65] text-ink/55">{card.body}</p>
                <p className="mt-4 flex items-center gap-1.5 border-t border-ink/10 pt-3 font-mono text-[8.5px] text-ink/30">
                  <Radio className="h-2.5 w-2.5" />
                  {card.signal}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-3.5 flex flex-col gap-5 rounded-2xl bg-ink p-6 text-paper sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-amber/20 bg-amber/8">
                <FileWarning className="h-4 w-4 text-amber" />
              </span>
              <div>
                <p className="text-[14px] font-medium">If the connector goes dark, Silo fails closed.</p>
                <p className="mt-1 max-w-[620px] text-[12.5px] leading-relaxed text-paper/45">
                  Changes are purged on your server even when Silo is unreachable. If the connector is
                  deactivated or its key is rejected, cached pages stop being served and every request
                  goes to WooCommerce. Stale stock is worse than a slower page.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 font-mono text-[9px] text-paper/35">
              <ShieldCheck className="h-3.5 w-3.5 text-mint/70" />
              on-site purge first
            </div>
          </div>
        </div>
      </section>

      <DashboardSection />

      <CtaBand />
    </>
  );
}
