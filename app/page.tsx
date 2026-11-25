import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { ConnectButton } from "@/components/connect/connect-button";
import { HeroPanel } from "@/components/hero-panel";
import { Counter } from "@/components/counter";
import { ProblemSection } from "@/components/problem-section";
import { HowSteps } from "@/components/how-steps";
import { InvalidationGraph } from "@/components/invalidation-graph";
import { Features } from "@/components/features";
import { DashboardSection } from "@/components/dashboard-section";
import { ComparisonTable } from "@/components/comparison-table";
import { PricingCards, StoreIsolationNote } from "@/components/pricing-cards";
import { CtaBand } from "@/components/cta-band";
import { PLANS } from "@/lib/content";
import { siteUrl } from "@/lib/utils";

const STATS = [
  { value: 16, decimals: 0, suffix: "", label: "cache plugins, hosts and CDNs kept in step" },
  { value: 2, decimals: 0, suffix: "", label: "devices warmed per page, desktop and mobile" },
  { value: 4, decimals: 0, suffix: " min", label: "typical install, key to first cached page" },
  { value: 0, decimals: 0, suffix: "", label: "cart, checkout or account pages ever cached" },
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Silo",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "WooCommerce page cache with inventory-aware invalidation. Stock and prices stay accurate. Works with WP Rocket and LiteSpeed. 3-day free trial.",
      url: siteUrl(),
      offers: PLANS.flatMap((plan) => [
        {
          "@type": "Offer",
          name: `${plan.name} (monthly)`,
          price: String(plan.price),
          priceCurrency: "USD",
          description: `${plan.storeLabel}, ${plan.events}, billed monthly`,
          url: `${siteUrl()}/pricing`,
        },
        {
          "@type": "Offer",
          name: `${plan.name} (annual)`,
          price: String(plan.annual),
          priceCurrency: "USD",
          description: `${plan.storeLabel}, ${plan.events}, billed yearly (2 months free)`,
          url: `${siteUrl()}/pricing`,
        },
      ]),
      featureList: [
        "Surgical invalidation for WooCommerce",
        "Inventory and variation aware",
        "Store API and Blocks support",
        "Priority warmup",
        "Cart and checkout never cached",
        "HPOS compatible",
        "Works alongside WP Rocket, LiteSpeed Cache and other page caches",
        "Cloudflare and host cache purging",
      ],
      publisher: {
        "@type": "Organization",
        name: "Silo for WooCommerce",
        url: siteUrl(),
        logo: `${siteUrl()}/icon.svg`,
        sameAs: ["https://www.linkedin.com/in/rynaldo-stoltz", "https://x.com/Rynald0c"],
      },
    },
    {
      "@type": "WebSite",
      name: "Silo for WooCommerce",
      url: siteUrl(),
      description: "Inventory-aware page cache for WooCommerce.",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <section className="noise relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_50%_0%,black,transparent_72%)]" />
        <div className="pointer-events-none absolute -top-40 right-[-10%] h-[560px] w-[620px] rounded-full bg-accent/12 blur-[140px]" />
        <div className="pointer-events-none absolute bottom-0 left-[-10%] h-[380px] w-[420px] rounded-full bg-woo/6 blur-[120px]" />

        <div className="container-page relative pb-12 pt-10 sm:pt-14 lg:pb-16 lg:pt-16">
          <div className="grid items-center gap-12 lg:grid-cols-[1.03fr_0.97fr] lg:gap-10 xl:gap-14">
            <div>
              <h1
                className="display animate-rise text-[clamp(32px,3.9vw,48px)] text-paper"
                style={{ animationDelay: "110ms" }}
              >
                The only cache that understands{" "}
                <span className="text-accent-hi">WooCommerce inventory.</span>
              </h1>

              <p
                className="animate-rise mt-5 max-w-[520px] text-[15.5px] leading-[1.65] tracking-[-0.01em] text-paper/60 sm:text-[16.5px]"
                style={{ animationDelay: "190ms" }}
              >
                Full-page cache speed without selling what you no longer have. Every order,
                refund, sale and stock edit clears exactly the pages it affects (the product,
                the variation, its categories and Store API results) and rewarms them in the
                background. Already on WP Rocket or LiteSpeed? Keep it. Silo makes it
                WooCommerce-accurate.
              </p>

              <div
                className="animate-rise mt-7 flex flex-col gap-3 sm:flex-row sm:items-center"
                style={{ animationDelay: "260ms" }}
              >
                <ConnectButton>
                  Connect your store
                  <ArrowRight className="h-4 w-4" />
                </ConnectButton>
                <Link href="/how-it-works" className="btn btn-secondary">
                  See how it works
                  <ArrowUpRight className="h-4 w-4 text-paper/40" />
                </Link>
              </div>

              <div
                className="animate-rise mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-paper/40"
                style={{ animationDelay: "330ms" }}
              >
                {["3-day trial", "No card required", "Installs in ~4 minutes"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-mint/70" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="animate-rise-slow relative" style={{ animationDelay: "220ms" }}>
              <HeroPanel />
            </div>
          </div>

          <div className="mt-12 grid grid-cols-2 gap-y-7 border-t border-white/8 pt-7 md:grid-cols-4 md:gap-0">
            {STATS.map((stat, index) => (
              <div
                key={stat.label}
                className={
                  index !== 0
                    ? "md:border-l md:border-white/8 md:pl-8"
                    : "md:pr-8"
                }
              >
                <p className="font-display text-[26px] leading-none tracking-[-0.045em] text-paper sm:text-[30px]">
                  <Counter
                    value={stat.value}
                    decimals={stat.decimals}
                    suffix={stat.suffix}
                  />
                </p>
                <p className="mt-2 max-w-[170px] text-[10.5px] leading-snug text-paper/35">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ProblemSection />
      <HowSteps />
      <InvalidationGraph />
      <Features />
      <DashboardSection />

      <section className="surface-paper">
        <div className="container-page section">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                Compare
              </p>
              <h2 className="display-tight mt-5 max-w-[660px] text-[clamp(28px,3.6vw,44px)] text-ink">
                Know what changed.
                <span className="text-ink/32"> Not just that something changed.</span>
              </h2>
            </div>
            <div>
              <p className="lede-dark max-w-[430px]">
                WP Rocket and FlyingPress are good at broad WordPress performance. Neither was
                built around variable products, stock events or Store API filters. That is the
                gap Silo fills. Keep them if you like: Silo runs alongside and keeps their cache
                accurate for WooCommerce.
              </p>
              <Link href="/pricing" className="link-arrow mt-5">
                See plans and pricing
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="mt-12">
            <ComparisonTable />
          </div>
        </div>
      </section>

      <section className="surface-paper bg-paper-2">
        <div className="container-page section">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="eyebrow text-accent-deep">
                <span className="h-px w-6 bg-accent-deep" />
                Pricing
              </p>
              <h2 className="display-tight mt-5 max-w-[600px] text-[clamp(28px,3.6vw,44px)] text-ink">
                Priced per store.
                <span className="text-ink/32"> Not per panic.</span>
              </h2>
            </div>
            <p className="lede-dark max-w-[390px]">
              One, three or five stores. Unlimited products on every plan. All core invalidation
              features included — no &ldquo;pro&rdquo; tier for correct stock.
            </p>
          </div>

          <div className="mt-12">
            <PricingCards />
            <StoreIsolationNote />
          </div>

          <div className="mt-8 flex flex-col items-start justify-between gap-4 border-t border-ink/10 pt-6 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-[11.5px] text-ink/45">
              <ShieldCheck className="h-3.5 w-3.5 text-ink/40" />
              Cancel anytime. Annual plans refundable within 30 days.
            </p>
            <Link href="/pricing" className="link-arrow">
              Full pricing & FAQ
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
