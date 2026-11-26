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
                <span className="font-mono text-[11px] tracking-[0.12em] text-ink/40">
                  {problem.number}
                </span>
                <problem.icon className="h-4 w-4 text-ink/40" strokeWidth={1.6} />
              </div>

              <MiniVisual kind={problem.visual} />

              <h3 className="mt-6 text-[18px] font-semibold tracking-[-0.022em] text-ink">
                {problem.title}
              </h3>
              <p className="mt-2 max-w-[460px] text-[14.5px] leading-[1.65] text-ink/65">
                {problem.body}
              </p>
              <p className="mt-5 flex items-center gap-2 border-t border-ink/10 pt-3 font-mono text-[11px] uppercase tracking-[0.06em] text-ink/55">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c23b3b]/80" />
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

/** Readable-on-light status colours (the base rose/amber are too pale for text on paper). */
const ROSE = "text-[#c23b3b]";
const AMBER = "text-[#a35f07]";

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 rounded-xl border border-ink/10 bg-paper p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{children}</div>;
}

function Badge({ tone, children }: { tone: "rose" | "amber"; children: React.ReactNode }) {
  return (
    <span
      className={
        tone === "rose"
          ? `rounded-md border border-[#c23b3b]/20 bg-[#c23b3b]/[0.07] px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.04em] ${ROSE}`
          : `rounded-md border border-[#a35f07]/20 bg-[#f4a63a]/[0.12] px-2 py-0.5 font-mono text-[10.5px] font-medium tracking-[0.04em] ${AMBER}`
      }
    >
      {children}
    </span>
  );
}

function Footnote({ left, right, tone = "rose" }: { left: string; right: string; tone?: "rose" | "amber" }) {
  return (
    <div className="mt-3 flex items-center justify-between border-t border-ink/[0.07] pt-2.5 font-mono text-[11px]">
      <span className="text-ink/45">{left}</span>
      <span className={tone === "rose" ? ROSE : AMBER}>{right}</span>
    </div>
  );
}

function MiniVisual({ kind }: { kind: (typeof PROBLEMS)[number]["visual"] }) {
  if (kind === "stock") {
    return (
      <Panel>
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-medium text-ink/80">Aster Linen Shirt</span>
          <Badge tone="rose">M SOLD OUT</Badge>
        </div>
        <div className="mt-3 flex gap-1.5">
          {["S", "M", "L", "XL"].map((size) => (
            <span
              key={size}
              className={
                size === "M"
                  ? "flex h-8 flex-1 items-center justify-center rounded-md border border-[#c23b3b]/30 bg-[#c23b3b]/[0.05] font-mono text-[12px] text-[#c23b3b] line-through"
                  : "flex h-8 flex-1 items-center justify-center rounded-md border border-ink/12 bg-white font-mono text-[12px] text-ink/70"
              }
            >
              {size}
            </span>
          ))}
        </div>
        <Footnote left="cached 3h ago" right="M still addable to cart" />
      </Panel>
    );
  }

  if (kind === "price") {
    return (
      <Panel>
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-medium text-ink/80">Coast Runner</span>
          <Badge tone="amber">SALE ENDED</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <div className="rounded-md border border-[#c23b3b]/25 bg-white px-3 py-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/45">Category page</p>
            <p className={`mt-0.5 font-display text-[20px] tracking-[-0.03em] ${ROSE}`}>€129</p>
          </div>
          <div className="rounded-md border border-ink/12 bg-white px-3 py-2">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink/45">Cart charges</p>
            <p className="mt-0.5 font-display text-[20px] tracking-[-0.03em] text-ink">€149</p>
          </div>
        </div>
        <Footnote left="archive cached before the sale ended" right="€20 mismatch" />
      </Panel>
    );
  }

  if (kind === "purge") {
    return (
      <Panel>
        <div className="flex items-center justify-between">
          <span className="text-[13.5px] font-medium text-ink/80">One stock change</span>
          <Badge tone="rose">FULL PURGE</Badge>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <div className="h-full w-full rounded-full bg-[#c23b3b]/70" />
            </div>
            <span className="w-24 text-right font-mono text-[11px] text-ink/70">20,000 cleared</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
              <div className="h-full w-[6%] rounded-full bg-mint-deep" />
            </div>
            <span className="w-24 text-right font-mono text-[11px] text-mint-deep">5 needed</span>
          </div>
        </div>
        <Footnote left="pages to re-render" right="1h 40m queue" tone="amber" />
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-medium text-ink/80">Shared cache · cart fragment</span>
        <Badge tone="rose">LEAK</Badge>
      </div>
      <div className="mt-3 flex items-center justify-between rounded-md border border-ink/12 bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 font-mono text-[11px] font-medium text-accent-deep">A</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-mint/20 font-mono text-[11px] font-medium text-mint-deep">B</span>
          <span className="text-[12.5px] text-ink/60">get the same response</span>
        </div>
        <span className="font-mono text-[12px] text-ink/80">2 items · €148</span>
      </div>
      <Footnote left="no session in the cache key" right="shopper A sees B's cart" />
    </Panel>
  );
}
