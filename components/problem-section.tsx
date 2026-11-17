import Link from "next/link";
import { ArrowRight, Clock3, Layers3, ShoppingBag, Tag } from "lucide-react";

const PROBLEMS = [
  {
    number: "01",
    icon: ShoppingBag,
    title: "Stale stock on a live page",
    body: "A size sells out. The product page still offers it, the archive still shows it in stock, and the shopper only finds out at checkout.",
    symptom: "Oversells, refunds, support tickets",
    visual: "stock",
  },
  {
    number: "02",
    icon: Tag,
    title: "Prices that drift",
    body: "A sale ends. Cached category pages keep the old price while the cart charges the new one. Nobody notices until a customer does.",
    symptom: "Price mismatches across archives",
    visual: "price",
  },
  {
    number: "03",
    icon: Layers3,
    title: "The full-purge reflex",
    body: "Every order or stock edit clears the whole storefront. The origin re-renders thousands of pages and the next shoppers absorb the latency.",
    symptom: "TTFB spikes exactly when traffic is high",
    visual: "purge",
  },
  {
    number: "04",
    icon: Clock3,
    title: "Carts leaking into cache",
    body: "A shared cache stores a fragment containing someone else's cart. Two shoppers, one session. It is the worst kind of cache bug.",
    symptom: "Session bleed across customers",
    visual: "cart",
  },
] as const;

export function ProblemSection() {
  return (
    <section className="surface-paper relative overflow-hidden">
      <div className="grid-bg-dark pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]" />
      <div className="container-page section relative">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
          <div>
            <p className="eyebrow text-accent-deep">
              <span className="h-px w-6 bg-accent-deep" />
              The failure mode
            </p>
            <h2 className="display-tight mt-5 max-w-[760px] text-[clamp(28px,3.6vw,44px)] text-ink">
              Most caches were built for blog posts.{" "}
              <span className="text-ink/32">Your catalog is not a blog post.</span>
            </h2>
          </div>
          <div className="lg:pb-1">
            <p className="lede-dark max-w-[430px]">
              A cache is only useful if it is correct. On a WooCommerce store, one stock change
              can touch a product page, four archives, a variation payload and a Store API
              route. Generic caches don&apos;t know any of that, so they guess, purge everything,
              or leave stale stock on sale.
            </p>
            <Link href="/how-it-works" className="link-arrow mt-6">
              See the invalidation model
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {PROBLEMS.map((problem) => (
            <article
              key={problem.number}
              className="group relative overflow-hidden rounded-2xl border border-ink/10 bg-white/55 p-5 transition-colors duration-300 hover:bg-white/80 sm:p-6"
            >
              <div className="flex items-start justify-between">
                <span className="font-mono text-[10px] tracking-[0.12em] text-ink/30">
                  {problem.number}
                </span>
                <problem.icon className="h-4 w-4 text-ink/30" strokeWidth={1.6} />
              </div>

              <MiniVisual kind={problem.visual} />

              <h3 className="mt-6 text-[18px] font-semibold tracking-[-0.022em] text-ink">
                {problem.title}
              </h3>
              <p className="mt-2 max-w-[430px] text-[13.5px] leading-[1.65] text-ink/55">
                {problem.body}
              </p>
              <p className="mt-5 flex items-center gap-2 border-t border-ink/10 pt-3 font-mono text-[10px] uppercase tracking-[0.06em] text-ink/35">
                <span className="h-1 w-1 rounded-full bg-rose/70" />
                {problem.symptom}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-ink/10 bg-white/60">
          <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                A different question
              </p>
              <p className="display-tight mt-4 text-[clamp(24px,3vw,34px)] text-ink">
                The fix isn&apos;t a faster purge.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-ink/10 bg-paper px-2 py-1 font-mono text-[9px] text-ink/35">
                  which URL changed?
                </span>
                <ArrowRight className="h-3 w-3 text-ink/20" />
                <span className="rounded-md border border-accent/20 bg-accent/[0.07] px-2 py-1 font-mono text-[9px] text-accent-deep">
                  which catalog fact changed?
                </span>
              </div>
            </div>
            <div className="lg:border-l lg:border-ink/10 lg:pl-8">
              <p className="text-[14px] leading-[1.7] text-ink/55">
                Generic caches start with a URL and purge what looks related.{" "}
                <span className="font-medium text-ink">
                  Silo starts with the catalog fact that changed
                </span>{" "}
                — a variation, price or stock level — then walks the graph to every response that
                depends on it, and stops.
              </p>
              <Link href="/how-it-works" className="link-arrow group mt-5">
                Invalidation, explained
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniVisual({ kind }: { kind: (typeof PROBLEMS)[number]["visual"] }) {
  if (kind === "stock") {
    return (
      <div className="mt-5 rounded-lg border border-white/8 bg-[#0b0d11] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] text-paper/60">Aster Linen Shirt</span>
          <span className="rounded bg-rose/10 px-1.5 py-0.5 font-mono text-[7.5px] text-rose">
            SOLD OUT
          </span>
        </div>
        <div className="mt-2.5 flex gap-1">
          {["S", "M", "L", "XL"].map((size) => (
            <span
              key={size}
              className={
                size === "M"
                  ? "flex h-6 flex-1 items-center justify-center rounded border border-rose/25 bg-rose/5 font-mono text-[8px] text-rose/60 line-through"
                  : "flex h-6 flex-1 items-center justify-center rounded border border-white/9 font-mono text-[8px] text-paper/45"
              }
            >
              {size}
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[7.5px]">
          <span className="text-paper/25">cached 3h ago · TTL 10:00</span>
          <span className="text-rose/60">still addable</span>
        </div>
      </div>
    );
  }

  if (kind === "price") {
    return (
      <div className="mt-5 rounded-lg border border-white/8 bg-[#0b0d11] p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] text-paper/60">Coast Runner · archive</span>
          <span className="font-mono text-[7.5px] text-paper/25">category / running</span>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[18px] tracking-[-0.03em] text-paper/45 line-through">
              €129
            </span>
            <span className="font-display text-[18px] tracking-[-0.03em] text-paper">
              €149
            </span>
          </div>
          <span className="rounded bg-amber/10 px-1.5 py-0.5 font-mono text-[7.5px] text-amber">
            SALE ENDED
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[7.5px]">
          <span className="text-paper/25">cart reads €149</span>
          <span className="text-rose/60">page reads €129</span>
        </div>
      </div>
    );
  }

  if (kind === "purge") {
    return (
      <div className="mt-5 rounded-lg border border-white/8 bg-[#0b0d11] p-3">
        <div className="flex items-center justify-between font-mono text-[7.5px] text-paper/30">
          <span>PURGE SCOPE</span>
          <span className="text-rose/60">FULL STOREFRONT</span>
        </div>
        <div className="mt-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-white/5">
              <div className="h-full w-full rounded-sm bg-gradient-to-r from-rose/50 to-rose/20" />
            </div>
            <span className="w-14 font-mono text-[7.5px] text-paper/40">20,000 URLs</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-sm bg-white/5">
              <div className="h-full w-[8%] rounded-sm bg-mint/60" />
            </div>
            <span className="w-14 font-mono text-[7.5px] text-mint/60">5 needed</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[7.5px]">
          <span className="text-paper/25">origin warmup</span>
          <span className="text-amber/70">1h 40m queue</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-white/8 bg-[#0b0d11] p-3">
      <div className="flex items-center justify-between">
        <span className="text-[9.5px] text-paper/60">Shared cache · /cart-fragments</span>
        <span className="rounded bg-rose/10 px-1.5 py-0.5 font-mono text-[7.5px] text-rose">
          LEAK
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded border border-white/8 bg-white/[0.02] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent/20 font-mono text-[7px] text-accent-hi">
            A
          </span>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-mint/15 font-mono text-[7px] text-mint">
            B
          </span>
          <span className="text-[8px] text-paper/45">same response</span>
        </div>
        <span className="font-mono text-[8px] text-paper/70">2 items · €148</span>
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[7.5px]">
        <span className="text-paper/25">no session key</span>
        <span className="text-rose/60">customer A sees B</span>
      </div>
    </div>
  );
}
