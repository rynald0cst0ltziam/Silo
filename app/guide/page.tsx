import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Download,
  Flame,
  KeyRound,
  LifeBuoy,
  Lock,
  Package,
  Plug,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ConnectButton } from "@/components/connect/connect-button";
import { CtaBand } from "@/components/cta-band";

export const metadata: Metadata = {
  title: "Silo, explained",
  description:
    "A plain-English guide to Silo: what a cache does for a WooCommerce store, what happens when you connect, what happens when a product changes, and what every number in your dashboard means.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Silo, explained — a plain-English guide",
    description: "What Silo does for your WooCommerce store, step by step, without the jargon.",
    url: "/guide",
  },
};

const CONNECT_STEPS = [
  {
    icon: Package,
    title: "Install the connector",
    body: "A small WordPress plugin. Upload it under Plugins → Add New → Upload Plugin and activate it. WooCommerce must be active.",
  },
  {
    icon: KeyRound,
    title: "Paste your store key",
    body: "Open WooCommerce → Silo and paste the key from your Silo dashboard. The key belongs to that one store and is never sent over the wire — only a fingerprint of it.",
  },
  {
    icon: ScanLine,
    title: "Watch the scan",
    body: "Silo reads your catalog: every product and product type, variations, stock, categories, tags, brands and filters. Nothing on your store is changed and no pages are loaded. You watch it happen live in WordPress and in Silo.",
  },
  {
    icon: Flame,
    title: "You're live",
    body: "Caching starts, your most important pages are prepared in the background, and from then on every change in WooCommerce is handled automatically.",
  },
];

const CHANGE_TIMELINE = [
  { time: "0s", text: "A customer buys the last medium Aster Linen Shirt. WooCommerce lowers the stock." },
  { time: "instantly", text: "The connector clears the saved copies of that product page, its categories, the shop page and the product lists used by blocks — right on your server." },
  { time: "a moment later", text: "Silo double-checks the full list of affected pages and decides which ones to prepare again first." },
  { time: "seconds later", text: "Those pages are rebuilt in the background, for desktop and mobile." },
  { time: "next visitor", text: "Sees “Sold out” on medium — and gets the page instantly. Every other product page stayed saved the whole time." },
];

const NEVER_CACHED = [
  "Cart and checkout",
  "My account and order history",
  "Anyone logged in",
  "Anyone with something in their cart",
  "Searches and add-to-cart links",
  "WordPress admin",
];

const GLOSSARY = [
  {
    term: "Hit rate",
    body: "Out of every visit to a product, shop or category page by an anonymous shopper, how many were answered from a saved copy. Higher is faster. It climbs as pages get visited and prepared.",
  },
  {
    term: "Avg response",
    body: "How long your server takes to answer when the page comes from Silo, next to how long it takes WooCommerce to build the page from scratch.",
  },
  {
    term: "Invalidations",
    body: "Catalog changes Silo acted on — a stock change, a price change, a product edit, an order, a refund, a category edit. Each one clears only the pages that change depends on.",
  },
  {
    term: "Warmup queue",
    body: "Pages waiting to be prepared again after a change, so a shopper never has to wait for them. Each one is shown as queued, warming, warm or failed.",
  },
  {
    term: "Bypassed",
    body: "Visits that must be personal — carts, logins, checkout — so they go straight to WooCommerce and are never saved or shared. This is a safety boundary, not a problem.",
  },
  {
    term: "Cached pages",
    body: "How many saved pages exist right now. One product can have a few: desktop and mobile, and one per currency or language if your store has them.",
  },
  {
    term: "Catalog graph",
    body: "Silo's map of your store: which products belong to which categories, which variations belong to which product, which product lists can show them. It is how Silo knows exactly what a change affects.",
  },
  {
    term: "Connector online",
    body: "The plugin on your store has checked in with Silo recently. If it hasn't, your store still clears its own pages after every change.",
  },
];

const HEADERS = [
  { name: "HIT", body: "Served from a saved copy. Fast." },
  { name: "MISS", body: "Built fresh and saved for the next visitor (first visit, or right after a change)." },
  { name: "STALE", body: "An older copy served once while a fresh one is built in the background." },
  { name: "BYPASS", body: "A personal visit (cart, login, session). Always built live, never saved." },
];

export default function GuidePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_40%_0%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[420px] w-[460px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="container-page relative py-14 sm:py-20">
          <p className="eyebrow text-accent-hi">
            <span className="h-px w-6 bg-accent-hi" />
            Guide
          </p>
          <h1 className="display mt-5 max-w-[760px] text-[clamp(36px,5vw,58px)] text-paper">
            Silo, explained
            <br />
            <span className="text-paper/38">in plain English.</span>
          </h1>
          <p className="lede mt-6 max-w-[620px]">
            Silo makes your WooCommerce store faster by saving ready-made copies of your product and category pages, and
            it keeps those copies honest: the moment stock, a price or a product changes, the affected pages are
            replaced. Nothing else on your store is touched.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ConnectButton size="lg">
              Connect your store
              <ArrowRight className="h-4 w-4" />
            </ConnectButton>
            <Link href="/how-it-works" className="btn btn-secondary btn-lg">
              The technical version
            </Link>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page section-sm">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                The idea
              </p>
              <h2 className="display-tight mt-5 text-[clamp(28px,3.4vw,40px)] text-ink">
                Why a shop needs a different kind of cache
              </h2>
            </div>
            <div className="space-y-4 text-[16px] leading-[1.75] text-ink/65">
              <p>
                Every time someone opens a product page, WooCommerce builds it from scratch: it looks up the product, the
                price, the stock, the reviews, the related products and your theme. That takes time — often half a second
                or more — and it happens for every single visitor.
              </p>
              <p>
                A <strong className="text-ink">cache</strong> builds the page once and hands out copies. That is why it is
                fast. The catch for a shop is that copies go out of date: a product sells out, a sale starts, a price
                changes. Most caching plugins solve that by throwing away <em>every</em> copy whenever anything changes,
                which makes the whole store slow again — or by waiting a few hours, which shows customers the wrong stock.
              </p>
              <p>
                Silo knows how your catalog fits together, so when one product changes it replaces only the pages that
                show that product — the product page, its categories, the shop page and the product lists your blocks use
                — and leaves everything else fast.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="container-page section-sm">
          <p className="eyebrow text-accent-hi">
            <span className="h-px w-6 bg-accent-hi" />
            Getting started
          </p>
          <h2 className="display-tight mt-5 max-w-[640px] text-[clamp(28px,3.4vw,40px)] text-paper">
            What happens when you connect
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {CONNECT_STEPS.map((step, index) => (
              <article key={step.title} className="card-dark p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                    <step.icon className="h-4 w-4 text-accent-hi" />
                  </span>
                  <span className="font-mono text-[12px] tracking-[0.12em] text-paper/30">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.02em] text-paper">{step.title}</h3>
                <p className="mt-2 text-[14.5px] leading-[1.65] text-paper/55">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page section-sm">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                Every day
              </p>
              <h2 className="display-tight mt-5 text-[clamp(28px,3.4vw,40px)] text-ink">
                What happens when something changes
              </h2>
              <p className="lede-dark mt-5 max-w-[420px]">
                You do nothing. Edit products, run sales and take orders exactly as before — Silo follows along.
              </p>
            </div>
            <ol className="relative space-y-5 border-l border-ink/12 pl-6">
              {CHANGE_TIMELINE.map((step) => (
                <li key={step.time} className="relative">
                  <span className="absolute -left-[31px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-accent-deep ring-4 ring-paper" />
                  <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-accent-deep">{step.time}</p>
                  <p className="mt-1 text-[16px] leading-[1.6] text-ink/70">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-3">
            {[
              { icon: Zap, title: "Sale prices on time", body: "Sales that start or end at a set time update at that exact moment, not at midnight." },
              { icon: RefreshCw, title: "Orders and refunds", body: "Stock that changes through an order, a cancellation or a refund is handled the same way as a manual edit." },
              { icon: ShieldCheck, title: "Theme and menu changes", body: "Changing your theme, menus, widgets or WooCommerce settings refreshes every saved page." },
              { icon: Plug, title: "Your other cache plugins", body: "Keep WP Rocket, LiteSpeed or your host's cache. Silo works alongside them and tells them exactly which pages to refresh." },
              { icon: Package, title: "Page builders", body: "Saving an Elementor, Divi or Beaver Builder product layout refreshes that product. Changing a header or footer refreshes every page." },
              { icon: Lock, title: "If something goes wrong", body: "If Silo can't be reached or your plan ends, your store simply shows live pages. It never shows an old price." },
            ].map((item) => (
              <div key={item.title} className="card-light p-5">
                <item.icon className="h-5 w-5 text-accent-deep" />
                <p className="mt-3 text-[16px] font-semibold text-ink">{item.title}</p>
                <p className="mt-1.5 text-[14.5px] leading-[1.6] text-ink/60">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="container-page section-sm">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow text-accent-hi">
                <span className="h-px w-6 bg-accent-hi" />
                Safety
              </p>
              <h2 className="display-tight mt-5 text-[clamp(28px,3.4vw,40px)] text-paper">What is never saved</h2>
              <p className="lede mt-5 max-w-[460px]">
                Anything personal is always built fresh for the person asking. One customer can never see another
                customer&apos;s cart, prices or account. There is nothing to configure.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {NEVER_CACHED.map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5">
                  <Lock className="h-4 w-4 shrink-0 text-mint" />
                  <span className="text-[15px] text-paper/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page section-sm">
          <p className="eyebrow text-accent-deep">
            <span className="h-px w-6 bg-accent-deep" />
            Your dashboard
          </p>
          <h2 className="display-tight mt-5 max-w-[640px] text-[clamp(28px,3.4vw,40px)] text-ink">
            What every number means
          </h2>
          <p className="lede-dark mt-4 max-w-[600px]">
            You see the same numbers in your Silo dashboard and in WordPress under WooCommerce → Silo. They update
            every few seconds.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {GLOSSARY.map((item) => (
              <div key={item.term} className="card-light p-5">
                <p className="text-[16px] font-semibold text-ink">{item.term}</p>
                <p className="mt-2 text-[14.5px] leading-[1.6] text-ink/60">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl bg-ink p-6 text-paper sm:p-8">
            <p className="text-[18px] font-semibold">Checking a page yourself</p>
            <p className="mt-2 max-w-[640px] text-[15px] leading-[1.65] text-paper/55">
              Every page Silo handles carries an <code className="font-code text-paper/80">x-silo-cache</code> label in
              its response headers (visible in your browser&apos;s developer tools, under Network). WooCommerce → Silo →
              Status → Run live checks does the test for you. If you also run WP Rocket or LiteSpeed, that plugin serves
              the pages and Silo keeps its copies fresh, so you will see its label instead.
            </p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {HEADERS.map((h) => (
                <div key={h.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="font-code text-[15px] text-accent-hi">{h.name}</p>
                  <p className="mt-1.5 text-[14px] leading-[1.55] text-paper/60">{h.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-ink">
        <div className="container-page section-sm">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "If Silo can't be reached",
                body: "Your store keeps working and keeps clearing its own pages after every change. Events are sent to Silo as soon as the connection returns.",
              },
              {
                icon: Lock,
                title: "If the connector is switched off",
                body: "Deactivating it, disconnecting it or revoking its key stops saved pages being served straight away. Every visitor gets a live page.",
              },
              {
                icon: Download,
                title: "If you need help",
                body: "WooCommerce → Silo → Status → Download diagnostics creates one file with everything support needs. Email it with your store URL.",
              },
            ].map((item) => (
              <div key={item.title} className="card-dark p-5">
                <item.icon className="h-5 w-5 text-accent-hi" />
                <p className="mt-3 text-[17px] font-semibold text-paper">{item.title}</p>
                <p className="mt-1.5 text-[14.5px] leading-[1.65] text-paper/55">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[14px] text-paper/50">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-mint" /> No DNS changes
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-mint" /> No theme changes
            </span>
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-mint" /> Removes itself cleanly when deleted
            </span>
            <Link href="/faq" className="flex items-center gap-2 text-accent-hi">
              <LifeBuoy className="h-4 w-4" /> More questions in the FAQ
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
