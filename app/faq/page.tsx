import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { FaqList } from "@/components/faq";
import { CtaBand } from "@/components/cta-band";
import { FAQ_GROUPS } from "@/lib/content";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about Silo: WooCommerce cache correctness, surgical invalidation, cart and checkout bypass, HPOS, setup, store limits and billing.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "Silo FAQ — straight answers before you connect",
    description:
      "Correctness, invalidation, compatibility, setup and billing. The questions worth asking a WooCommerce cache.",
    url: "/faq",
  },
};

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_GROUPS.flatMap((group) =>
    group.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  ),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_40%_0%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[380px] w-[440px] rounded-full bg-accent/10 blur-[120px]" />
        <div className="container-page relative pb-12 pt-10 sm:pt-14">
          <div className="max-w-[760px]">
            <p className="eyebrow text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              FAQ
            </p>
            <h1 className="display mt-5 text-[clamp(34px,4.6vw,54px)] text-paper">
              Straight answers.
              <br />
              <span className="text-paper/38">Before you connect.</span>
            </h1>
            <p className="lede mt-6 max-w-[560px]">
              What is shared, what is private, and what happens when one variation sells out.
              The short answers are here; the docs cover the edge cases.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {FAQ_GROUPS.map((group) => (
                <a key={group.id} href={`#${group.id}`} className="chip">
                  {group.title}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page py-12 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-[210px_minmax(0,820px)] lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-28">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/30">
                  On this page
                </p>
                <nav className="mt-4 space-y-1 border-l border-ink/10 pl-4">
                  {FAQ_GROUPS.map((group, index) => (
                    <a
                      key={group.id}
                      href={`#${group.id}`}
                      className="flex items-baseline gap-2 py-1.5 text-[11.5px] text-ink/45 transition hover:text-ink"
                    >
                      <span className="font-mono text-[8px] text-ink/20">
                        0{index + 1}
                      </span>
                      {group.title}
                    </a>
                  ))}
                </nav>

                <div className="mt-7 rounded-xl border border-ink/10 bg-white/55 p-4">
                  <p className="text-[12px] font-medium text-ink">Still unsure?</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink/45">
                    Send the store URL. A human will tell you honestly whether Silo fits.
                  </p>
                  <a
                    href="mailto:rynaldostoltz85@gmail.com"
                    className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-accent-deep"
                  >
                    rynaldostoltz85@gmail.com
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <div className="space-y-14">
                {FAQ_GROUPS.map((group, index) => (
                  <section key={group.id} id={group.id} className="scroll-mt-28">
                    <div className="flex items-start gap-4">
                      <span className="mt-1 font-mono text-[9px] tracking-[0.08em] text-ink/25">
                        0{index + 1}
                      </span>
                      <div>
                        <h2 className="display-tight text-[clamp(24px,2.8vw,32px)] text-ink">
                          {group.title}
                        </h2>
                        <p className="mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-ink/50">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <FaqList items={group.items} />
                    </div>
                  </section>
                ))}
              </div>

              <div className="mt-12 flex flex-col gap-5 rounded-2xl border border-ink/10 bg-white/55 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <p className="text-[15px] font-medium tracking-[-0.015em] text-ink">
                    Didn&apos;t find your answer?
                  </p>
                  <p className="mt-1 max-w-[460px] text-[12.5px] leading-relaxed text-ink/45">
                    Ask a human, or read the implementation detail in the docs. Both are
                    maintained by the team that builds the connector.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <a
                    href="mailto:rynaldostoltz85@gmail.com"
                    className="btn btn-outline-dark btn-sm"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email us
                  </a>
                  <Link href="/docs" className="btn btn-outline-dark btn-sm">
                    Read the docs
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
