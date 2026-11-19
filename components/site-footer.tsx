"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Github, Linkedin, Mail } from "lucide-react";
import { Logo } from "@/components/logo";

const PRODUCT_LINKS = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/demo", label: "Dashboard demo" },
  { href: "/status", label: "System status" },
];

const RESOURCE_LINKS = [
  { href: "/docs", label: "Documentation" },
  { href: "/docs#requirements", label: "Connector requirements" },
  { href: "/faq", label: "FAQ" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refund policy" },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname.startsWith("/dashboard")) return null;
  return (
    <footer className="border-t border-white/8 bg-ink">
      <div className="container-page py-14 md:py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-5 max-w-[260px] text-[13.5px] leading-relaxed text-paper/45">
              The only cache built around the WooCommerce catalog graph. Surgical invalidation,
              accurate stock, warm priority pages.
            </p>
            <div className="mt-6 flex items-center gap-2">
              <a
                href="mailto:hello@getsilo.com"
                aria-label="Email Silo"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-paper/45 transition hover:border-white/25 hover:text-paper"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Silo on X"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-paper/45 transition hover:border-white/25 hover:text-paper"
              >
                <span className="text-[11px] font-semibold">X</span>
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Silo on GitHub"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-paper/45 transition hover:border-white/25 hover:text-paper"
              >
                <Github className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                aria-label="Silo on LinkedIn"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-paper/45 transition hover:border-white/25 hover:text-paper"
              >
                <Linkedin className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Resources" links={RESOURCE_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-paper/30">
            <span>© 2026 Silo Systems, Inc.</span>
            <span className="hidden h-3 w-px bg-white/10 sm:block" />
            <span>Built for WooCommerce, not blogs.</span>
          </div>
          <div className="flex items-center gap-5 text-[11.5px] text-paper/35">
            <Link href="/status" className="flex items-center gap-2 transition hover:text-paper/70">
              <span className="pulse-dot" />
              All systems operational
            </Link>
            <a
              href="mailto:support@getsilo.com"
              className="hidden items-center gap-1 transition hover:text-paper/70 sm:flex"
            >
              support@getsilo.com
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </div>
        </div>

        <p className="mt-6 max-w-[760px] text-[10.5px] leading-relaxed text-paper/20">
          Silo is an independent product and is not affiliated with or endorsed by WooCommerce,
          Automattic, WP Rocket, FlyingPress or LiteSpeed. Product names are used for
          identification only. Performance figures shown on this site are illustrative of the
          cache model, not a guarantee.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="mono-label uppercase">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-paper/50 transition hover:text-paper"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
