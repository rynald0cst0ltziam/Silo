import { FAQ_GROUPS, PLANS } from "@/lib/content";
import { TIERS } from "@/lib/tiers";
import { siteUrl } from "@/lib/utils";

export const LLMS_NAME = "Silo for WooCommerce";

const SUMMARY =
  "Silo for WooCommerce is a page cache built only for WooCommerce stores. It keeps product, shop and category pages fast, and when stock, prices, sales or orders change it clears exactly the pages that change affects and reloads them. It works alongside WP Rocket, LiteSpeed, W3 Total Cache, Cloudflare and page builders such as Elementor. Every new account gets a 7-day free trial with no card required.";

/** Plan facts taken from lib/tiers.ts, the same numbers the service enforces. */
export function planLines(): string[] {
  return (Object.keys(TIERS) as Array<keyof typeof TIERS>).map((slug) => {
    const t = TIERS[slug];
    return `- ${t.name}: $${t.priceMonthly}/month or $${t.priceAnnual}/year. Up to ${t.maxStores} store${t.maxStores === 1 ? "" : "s"}, ${t.maxMonthlyEvents.toLocaleString("en-US")} catalog events per month shared across stores, warmup of up to ${t.warmupUrlsPerEvent.toLocaleString("en-US")} pages per change (a ceiling, not a quota), ${t.logRetentionDays}-day logs.`;
  });
}

export function llmsTxt(): string {
  const base = siteUrl().replace(/\/+$/, "");
  return [
    `# ${LLMS_NAME}`,
    "",
    `> ${SUMMARY}`,
    "",
    `Website: ${base}`,
    "Maintainer: Rynaldo Stoltz (rynaldostoltz85@gmail.com)",
    "Requirements: WordPress 6.4+, WooCommerce 8.2+, PHP 8.1+, HTTPS.",
    "",
    "## Product",
    "",
    `- [How it works](${base}/how-it-works): the catalog graph and how changes are invalidated`,
    `- [Features and compatibility](${base}/faq): what is supported and how it behaves`,
    `- [Pricing](${base}/pricing): plans, limits and the 7-day free trial`,
    `- [Guide](${base}/guide): setup and daily use`,
    `- [Docs](${base}/docs): connector installation and troubleshooting`,
    `- [Status](${base}/status): live status of the service`,
    "",
    "## Plans",
    "",
    ...planLines(),
    "",
    "## Policies",
    "",
    `- [Privacy](${base}/privacy)`,
    `- [Terms](${base}/terms)`,
    `- [Refund policy](${base}/refund)`,
    "",
    "## Optional",
    "",
    `- [Full reference for language models](${base}/llms-full.txt): every FAQ answer and plan detail in one file`,
    `- [FAQ](${base}/faq)`,
    `- [Sitemap](${base}/sitemap.xml)`,
    "",
  ].join("\n");
}

export function llmsFullTxt(): string {
  const base = siteUrl().replace(/\/+$/, "");
  const faqs = FAQ_GROUPS.flatMap((g) => [
    `### ${g.title}`,
    "",
    ...g.items.flatMap((item) => [`**${item.q}**`, "", item.a, ""]),
  ]);
  return [
    `# ${LLMS_NAME}: full reference`,
    "",
    `> ${SUMMARY}`,
    "",
    `Website: ${base}`,
    "",
    "## What it does",
    "",
    "Silo caches WooCommerce product pages, the shop and category archives, and anonymous Store API responses. It builds a map of the catalog (products, variations, categories, tags, attributes, permalinks and Store API routes). When WooCommerce reports a change, such as a stock reduction, an order, a refund, a price or sale change, a review, a term edit or a menu change, Silo clears only the cached responses that depend on it, then reloads the priority pages for desktop and mobile. Cart, checkout, account pages and any request with a session, cart token, nonce or login are never cached.",
    "",
    "## Connection and failure behaviour",
    "",
    "A small connector plugin runs on the store and talks to Silo over signed HTTPS. Changes are cleared on the store itself first, so correctness does not depend on the connection. If the connector is deactivated, the store key is rejected, or the plan is inactive, the store stops serving cached pages and every request goes to WooCommerce.",
    "",
    "## Other caches and CDNs",
    "",
    "The connector detects existing page caches and can work alongside them instead of replacing them. Supported: WP Rocket, LiteSpeed Cache, W3 Total Cache, WP Super Cache, WP Fastest Cache, FlyingPress, SiteGround Optimizer, Hummingbird, Cache Enabler and WP-Optimize. Host and CDN layers: Cloudflare (purged through its API with a zone ID and token), Kinsta, WP Engine, Pantheon, SpinupWP and Nginx Helper. Page builders and themes: Elementor, WPBakery, Beaver Builder, Divi, Bricks, Oxygen, Breakdance, block themes, Woodmart, Astra, Kadence, GeneratePress, Blocksy and Flatsome. WooCommerce Product Bundles and brand plugins (WooCommerce Brands, Perfect Brands, YITH Brands) are supported. Developers can add pages with the silo_extra_urls filter and run code after a purge with the silo_invalidated action.",
    "",
    "## Plans and limits",
    "",
    ...planLines(),
    "",
    "Every new account starts with a 7-day free trial on Solo limits, with no card required. Choosing a plan during the trial carries the remaining time forward when Stripe allows it. When a trial or paid plan ends without a plan, caching pauses on the store until a plan is chosen.",
    "",
    "## Plans as listed on the site",
    "",
    ...PLANS.map((p) => `- ${p.name} (${p.storeLabel}, ${p.events}): ${p.features.join("; ")}`),
    "",
    "## Frequently asked questions",
    "",
    ...faqs,
    "## Links",
    "",
    `- How it works: ${base}/how-it-works`,
    `- Pricing: ${base}/pricing`,
    `- FAQ: ${base}/faq`,
    `- Docs: ${base}/docs`,
    `- Guide: ${base}/guide`,
    `- Status: ${base}/status`,
    `- Privacy: ${base}/privacy`,
    `- Terms: ${base}/terms`,
    `- Refunds: ${base}/refund`,
    "",
  ].join("\n");
}
