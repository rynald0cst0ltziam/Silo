import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { ConnectProvider } from "@/components/connect/connect-flow";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Analytics } from "@/components/analytics";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Silo — The only cache that understands WooCommerce inventory",
    template: "%s — Silo",
  },
  description:
    "Silo invalidates the exact product, variation, category and Store API response that changed, then re-warms the pages that matter. Cache built only for WooCommerce.",
  applicationName: "Silo",
  keywords: [
    "WooCommerce cache",
    "WooCommerce caching plugin",
    "inventory aware cache",
    "variable product cache",
    "WooCommerce Store API cache",
    "HPOS cache",
    "surgical invalidation",
  ],
  authors: [{ name: "Silo Systems, Inc." }],
  creator: "Silo",
  publisher: "Silo Systems, Inc.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Silo",
    title: "Silo — The only cache that understands WooCommerce inventory",
    description:
      "Surgical invalidation. Always-accurate stock. Sub-millisecond catalog pages. Built for products, variants, stock and orders — not blogs.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silo — The only cache that understands WooCommerce inventory",
    description:
      "Surgical invalidation. Always-accurate stock. Sub-millisecond catalog pages. Built for WooCommerce.",
    creator: "@getsilo",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen antialiased">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white"
          >
            Skip to content
          </a>
          <ConnectProvider>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
          </ConnectProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
