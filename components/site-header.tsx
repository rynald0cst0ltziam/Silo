"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { ConnectButton } from "@/components/connect/connect-button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/how-it-works", label: "Product" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname.startsWith("/dashboard")) return null;

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/8 bg-ink/85 backdrop-blur-xl">
        <div className="container-page flex h-[60px] items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
            {LINKS.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-[13px] font-medium transition",
                    active
                      ? "text-paper"
                      : "text-paper/55 hover:bg-white/[0.04] hover:text-paper",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden px-2 text-[13px] font-medium text-paper/60 transition hover:text-paper sm:block"
            >
              Log in
            </Link>
            <div className="hidden sm:block">
              <ConnectButton
                size="sm"
                className="h-8 px-3 text-[12px]"
              >
                Connect store
              </ConnectButton>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 text-paper/70 transition hover:border-white/25 hover:text-paper lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-ink lg:hidden">
          <div className="border-b border-white/8">
            <div className="container-page flex h-[60px] items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 text-paper/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <nav aria-label="Mobile" className="container-page flex flex-1 flex-col justify-between py-8">
            <div className="divide-y divide-white/8 border-y border-white/8">
              {LINKS.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between py-5 text-[24px] font-display tracking-[-0.03em] text-paper/85"
                >
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[10px] tracking-widest text-paper/25">
                      0{index + 1}
                    </span>
                    {link.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-paper/30" />
                </Link>
              ))}
              <Link
                href="/dashboard"
                className="flex items-center justify-between py-5 text-[24px] font-display tracking-[-0.03em] text-paper/85"
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[10px] tracking-widest text-paper/25">05</span>
                  Dashboard
                </span>
                <ArrowUpRight className="h-4 w-4 text-paper/30" />
              </Link>
            </div>

            <div className="mt-8 space-y-3">
              <ConnectButton size="lg" full onClick={() => setMenuOpen(false)}>
                Connect your store
                <ArrowRight className="h-4 w-4" />
              </ConnectButton>
              <Link
                href="/login"
                className="btn btn-secondary w-full"
                onClick={() => setMenuOpen(false)}
              >
                Log in to Silo
              </Link>
              <div className="flex items-center justify-between pt-5 text-[11px] text-paper/35">
                <span className="flex items-center gap-2">
                  <LogoMark className="h-5 w-5 rounded-md p-[3px]" />
                  Cache for WooCommerce
                </span>
                <Link href="/status" className="flex items-center gap-2">
                  <span className="pulse-dot" />
                  All systems operational
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
