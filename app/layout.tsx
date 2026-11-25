import type { Metadata, Viewport } from "next";
import { SessionProvider } from "next-auth/react";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { ConnectProvider } from "@/components/connect/connect-flow";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Analytics } from "@/components/analytics";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { siteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Silo for WooCommerce — Inventory-aware WooCommerce cache",
    template: "%s | Silo for WooCommerce",
  },
  description: "WooCommerce page cache with inventory-aware invalidation. Stock and prices stay accurate. Works with WP Rocket and LiteSpeed. 3-day free trial.",
  applicationName: "Silo for WooCommerce",
  keywords: [
    "WooCommerce cache",
    "WooCommerce caching plugin",
    "inventory aware cache",
    "variable product cache",
    "WooCommerce Store API cache",
    "HPOS cache",
    "surgical invalidation",
  ],
  authors: [{ name: "Rynaldo Stoltz", url: "https://www.linkedin.com/in/rynaldo-stoltz" }],
  creator: "Rynaldo Stoltz",
  publisher: "Silo for WooCommerce",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Silo for WooCommerce",
    title: "Silo for WooCommerce — Inventory-aware WooCommerce cache",
    description: "WooCommerce page cache with inventory-aware invalidation. Stock and prices stay accurate. Works with WP Rocket and LiteSpeed. 3-day free trial.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Silo for WooCommerce — Inventory-aware WooCommerce cache",
    description: "WooCommerce page cache with inventory-aware invalidation. Stock and prices stay accurate. Works with WP Rocket and LiteSpeed. 3-day free trial.",
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
    <SessionProvider>
      <html lang="en">
        {process.env.VERCEL_ENV === "production" ? (
          <head>
            {/* Ship or Die hackathon verification (production only). */}
            <script defer src="https://www.ship-or-die.com/hackathon/verify.js" data-site="b8fd70bc844897aa49d5c98f9b0ba3a53dae2733" />
          </head>
        ) : null}
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
          <AnalyticsTracker />
        </body>
      </html>
    </SessionProvider>
  );
}
