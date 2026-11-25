import Link from "next/link";
import { ArrowUpRight, Mail } from "lucide-react";

const LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/refund", label: "Refund policy" },
];

export function LegalPage({
  current,
  title,
  intro,
  updated = "November 16, 2026",
  children,
}: {
  current: string;
  title: string;
  intro: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_30%_0%,black,transparent_70%)]" />
        <div className="container-page relative py-10 sm:py-14">
          <div className="max-w-[820px]">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/30">
              <Link href="/" className="transition hover:text-paper/60">
                Home
              </Link>{" "}
              / Legal / {title}
            </p>
            <h1 className="display-tight mt-5 text-[clamp(32px,4vw,46px)] text-paper">{title}</h1>
            <p className="lede mt-4 max-w-[640px]">{intro}</p>
            <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.08em] text-paper/25">
              Last updated {updated} · Silo for WooCommerce
            </p>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page py-12 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-[200px_minmax(0,760px)] lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-32">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/30">
                  Legal
                </p>
                <nav className="mt-4 space-y-1 border-l border-ink/10 pl-4">
                  {LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block py-1.5 text-[11.5px] transition ${
                        current === link.href
                          ? "font-medium text-ink"
                          : "text-ink/40 hover:text-ink"
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>

                <div className="mt-7 rounded-lg border border-ink/10 bg-white/50 p-4">
                  <Mail className="h-4 w-4 text-ink/40" />
                  <p className="mt-2.5 text-[11.5px] font-medium text-ink">Questions?</p>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-ink/40">
                    Legal and privacy enquiries are answered by a human.
                  </p>
                  <a
                    href="mailto:rynaldostoltz85@gmail.com"
                    className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-accent-deep"
                  >
                    rynaldostoltz85@gmail.com
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </aside>

            <article className="prose-silo min-w-0 max-w-[760px]">{children}</article>
          </div>
        </div>
      </section>
    </>
  );
}
