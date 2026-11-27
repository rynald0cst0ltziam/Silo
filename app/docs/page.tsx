import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  CircleAlert,
  LifeBuoy,
  Plus,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { ConnectButton } from "@/components/connect/connect-button";
import { latestConnectorVersion } from "@/lib/connector-release";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Silo documentation: install the WooCommerce connector, paste your store key, scan the catalog, verify cache hits and troubleshoot.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "Silo docs — get a store connected",
    description:
      "Connector requirements, quickstart, invalidation events and troubleshooting.",
    url: "/docs",
  },
};

const NAV = [
  { href: "#quickstart", label: "Quickstart", number: "01" },
  { href: "#requirements", label: "Requirements", number: "02" },
  { href: "#invalidation", label: "Invalidation events", number: "03" },
  { href: "#hooks", label: "Developer hooks", number: "04" },
  { href: "#troubleshooting", label: "Troubleshooting", number: "05" },
  { href: "#support", label: "Limits & support", number: "06" },
];

const FULL_SET =
  "Product page, categories (with parents), tags, brands, attribute pages, grouped products and bundles that contain it, the shop page, any extra pages you listed, and the matching Store API results";

const EVENTS = [
  { event: "Order placed (stock reduced)", invalidates: `For each product in the order: ${FULL_SET}` },
  { event: "Stock changed (product or variation)", invalidates: FULL_SET },
  { event: "Order cancelled or refunded (stock restored)", invalidates: `For each restored product: ${FULL_SET}` },
  { event: "Price changed, or a scheduled sale starts or ends", invalidates: `${FULL_SET}. Scheduled sales are cleared at the exact minute they start or end.` },
  { event: "Product edited (content only)", invalidates: "The product page and any grouped products or bundles that contain it" },
  { event: "Product published, deleted, hidden or moved category", invalidates: FULL_SET },
  { event: "Category, tag, brand or attribute edited", invalidates: "That archive page and the matching Store API results" },
  { event: "Theme, menu, widget, template or builder CSS changed", invalidates: "Every cached page (they all share the header, footer and styles)" },
];

const TROUBLE = [
  {
    q: "The page returns x-silo-cache: BYPASS",
    a: "BYPASS is the safety boundary doing its job. Check for a WooCommerce session cookie, an Authorization header or a logged-in user. If the request is genuinely anonymous, confirm WooCommerce → Silo shows the connector online. If Silo is working alongside another cache plugin, that plugin serves the page, so check its header instead.",
  },
  {
    q: "The connector shows offline",
    a: "Open WooCommerce → Silo → Status. The page checks the store key, outbound HTTPS and the last heartbeat. A 401 usually means the key was rotated or copied from another store. A timeout usually means the host is blocking outbound requests to the connector API.",
  },
  {
    q: "A variation is still stale after a stock change",
    a: "Confirm the change came through WooCommerce rather than a direct database update. If it was direct SQL, WooCommerce never fired an event, so there is nothing for the connector to send. Changes made outside WooCommerce can be cleared with Purge all, and a rescan from Catalog re-reads the catalog.",
  },
  {
    q: "Warmup queue is stuck",
    a: "Warmup is intentionally lower priority than shopper traffic. If the queue is not moving, check origin response times and 429s. Lower Warmup concurrency under WooCommerce → Silo → Settings. A store that rate-limits its own origin will not warm faster with more workers.",
  },
  {
    q: "A customer sees another customer's cart",
    a: "This must never happen with Silo. Run Purge all under WooCommerce → Silo straight away, then email rynaldostoltz85@gmail.com with the page URL, the x-silo-cache header value and the approximate time so we can investigate.",
  },
  {
    q: "Do I keep my existing cache plugin?",
    a: "Yes. Silo detects WP Rocket, LiteSpeed Cache, W3 Total Cache, WP Super Cache, FlyingPress, SiteGround Optimizer and others and works alongside them: your plugin keeps serving pages, and Silo purges exactly the right pages in it on every stock, price, sale and order change, then rewarms them. Host caches (Kinsta, WP Engine, Pantheon, SpinupWP, Nginx Helper) and Cloudflare are purged in step. Prefer Silo to serve pages instead? Choose Silo serves pages in WooCommerce → Silo → Settings and turn off only the other plugin's page cache.",
  },
];

export default async function DocsPage() {
  const connector = await latestConnectorVersion();
  return (
    <>
      <section className="relative overflow-hidden bg-ink">
        <div className="grid-bg pointer-events-none absolute inset-0 opacity-25 [mask-image:radial-gradient(ellipse_at_40%_0%,black,transparent_70%)]" />
        <div className="pointer-events-none absolute right-0 top-0 h-[360px] w-[420px] rounded-full bg-accent/10 blur-[110px]" />
        <div className="container-page relative py-12 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-[1fr_0.72fr] lg:items-end">
            <div>
              <p className="eyebrow text-accent-hi">
                <span className="h-px w-6 bg-accent-hi" />
                Documentation
              </p>
              <h1 className="display mt-5 text-[clamp(34px,4.6vw,54px)] text-paper">
                Get a store
                <br />
                <span className="text-paper/38">connected.</span>
              </h1>
              <p className="lede mt-6 max-w-[520px]">
                Install the connector, paste the key, run the scan. About four minutes if you
                read quickly. The detail below is here for the edge cases.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["WordPress 6.4+", "WooCommerce 8.2+", "PHP 8.1+", "HPOS"].map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.025] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-paper/30">
                On this page
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {NAV.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-3 py-2 text-[11.5px] text-paper/55 transition hover:border-white/20 hover:text-paper"
                  >
                    <span className="font-mono text-[8px] text-paper/25">{item.number}</span>
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="surface-paper">
        <div className="container-page py-12 sm:py-16">
          <div className="grid gap-12 lg:grid-cols-[210px_minmax(0,780px)] lg:gap-16">
            <aside className="hidden lg:block">
              <div className="sticky top-32">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/30">
                  Docs
                </p>
                <nav className="mt-4 space-y-1 border-l border-ink/10 pl-4">
                  {NAV.map((item) => (
                    <a
                      key={item.href}
                      href={item.href}
                      className="flex items-baseline gap-2 py-1.5 text-[11.5px] text-ink/45 transition hover:text-ink"
                    >
                      <span className="font-mono text-[8px] text-ink/20">{item.number}</span>
                      {item.label}
                    </a>
                  ))}
                </nav>

                <div className="mt-7 rounded-lg bg-ink p-4 text-paper">
                  <LifeBuoy className="h-4 w-4 text-accent-hi" />
                  <p className="mt-2.5 text-[12px] font-medium">Stuck on a store?</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-paper/40">
                    Send the store URL and last request ID. A human replies.
                  </p>
                  <a
                    href="mailto:rynaldostoltz85@gmail.com"
                    className="mt-3 inline-flex items-center gap-1 text-[10.5px] text-accent-hi"
                  >
                    rynaldostoltz85@gmail.com
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </aside>

            <div className="min-w-0">
              <section id="quickstart" className="scroll-mt-28">
                <SectionTitle number="01" title="Quickstart" />
                <p className="mt-3 text-[14px] leading-relaxed text-ink/55">
                  You need a Silo store key and admin access to the WordPress install. The
                  connector only talks outbound; no inbound ports or DNS changes.
                </p>

                <div className="mt-7 space-y-6">
                  <Step number="1" title="Create the store and copy its key">
                    <p>
                      In the Silo dashboard, choose <strong>Stores → Add store</strong>. Name it,
                      enter the storefront URL, then copy the key. It begins with{" "}
                      <code>sk_silo_</code> and is scoped to one store only.
                    </p>
                    <Code>{`sk_silo_Qm8vT2xF9aLp3RkZ7wNcY4dH`}</Code>
                  </Step>

                  <Step number="2" title="Install the connector">
                    <p>
                      In WordPress, go to <strong>Plugins → Add New → Upload Plugin</strong>,
                      upload <code>silo-connector.zip</code> and activate it. WP-CLI works too:
                    </p>
                    <Code>{`wp plugin install silo-connector.zip --activate`}</Code>
                  </Step>

                  <Step number="3" title="Paste the key and scan">
                    <p>
                      Open <strong>WooCommerce → Silo → Settings</strong>, paste the key and save.
                      The connector checks outbound HTTPS and starts a catalog scan. The progress
                      card shows products, variations and Store API routes as they are mapped.
                    </p>
                    <div className="rounded-lg border border-amber/25 bg-amber/[0.06] p-3.5">
                      <p className="flex items-center gap-2 text-[12px] font-medium text-ink/75">
                        <CircleAlert className="h-3.5 w-3.5 text-amber" />
                        Keep your other cache plugins.
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-ink/50">
                        If WP Rocket, LiteSpeed or another page cache is active, Silo works alongside
                        it automatically. Using Cloudflare caching? Add its zone ID and API token under
                        Settings → Other caches and CDN so its copies are purged too.
                      </p>
                    </div>
                  </Step>

                  <Step number="4" title="Verify a hit and an invalidation">
                    <p>
                      Request an anonymous product page and check the response header. Then change
                      a variation's stock in WooCommerce and request it again.
                    </p>
                    <Code>{`curl -sI https://your-store.com/product/aster-linen-shirt \\
  | grep -i x-silo

x-silo-cache: HIT
x-silo-age: 128
x-silo-scope: product:1042`}</Code>
                    <p>
                      Every cached response says what it is (a product, an archive or the shop) and how old it is.
                      When that product changes, Silo invalidates it and its archives, not the whole storefront.
                    </p>
                    <p>
                      Working alongside another cache plugin? That plugin serves the page, so look for its
                      header or HTML comment instead. WooCommerce → Silo → Status shows which mode the store
                      is in and which caches Silo is keeping in step.
                    </p>
                  </Step>
                </div>
              </section>

              <section id="requirements" className="mt-16 scroll-mt-28">
                <SectionTitle number="02" title="Connector requirements" />
                <div className="mt-5 overflow-hidden rounded-xl border border-ink/10">
                  {[
                    ["WordPress", "6.4 or newer", true],
                    ["WooCommerce", "8.2 or newer", true],
                    ["PHP", "8.1 or newer, with curl and json", true],
                    ["HTTPS", "Required on the storefront", true],
                    ["Permalinks", "Pretty permalinks enabled", true],
                    ["Outbound access", "HTTPS to the connector API", true],
                    ["HPOS", "Supported, including refunds", true],
                    ["Multisite", "One store key per subsite", true],
                    ["Other page caches", "Supported: Silo works alongside them", true],
                    ["Page builders and themes", "Elementor, WPBakery, Beaver Builder, Divi, Bricks, Oxygen, Breakdance, Woodmart", true],
                    ["Bundles and brands", "WooCommerce Product Bundles, WooCommerce Brands, Perfect Brands, YITH Brands", true],
                    ["Full-page CDN cache", "Cloudflare purged by API; others must honor private/no-store", true],
                  ].map(([label, value, supported], index) => (
                    <div
                      key={label as string}
                      className={`flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${
                        index !== 11 ? "border-b border-ink/8" : ""
                      }`}
                    >
                      <span className="text-[12.5px] font-medium text-ink/70">{label}</span>
                      <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink/40">
                        {supported ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <CircleAlert className="h-3 w-3 text-amber" />
                        )}
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-ink/35">
                  <Server className="mt-0.5 h-3 w-3 shrink-0" />
                  The connector requires outbound requests only. No inbound firewall rule, no new
                  DNS record, no theme change.
                </p>
              </section>

              <section id="invalidation" className="mt-16 scroll-mt-28">
                <SectionTitle number="03" title="What each event invalidates" />
                <p className="mt-3 text-[14px] leading-relaxed text-ink/55">
                  The connector listens to WooCommerce&apos;s own hooks. It clears the affected
                  pages on your server first, then sends Silo a signed description of the change,
                  and Silo plans the warmup.
                </p>
                <div className="mt-5 overflow-hidden rounded-xl border border-ink/10">
                  <div className="grid grid-cols-[1.15fr_1fr] border-b border-ink/10 bg-ink/[0.025] px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.1em] text-ink/35">
                    <span>WooCommerce event</span>
                    <span>Invalidated nodes</span>
                  </div>
                  {EVENTS.map((row, index) => (
                    <div
                      key={row.event}
                      className={`grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[1.15fr_1fr] sm:gap-4 ${
                        index !== EVENTS.length - 1 ? "border-b border-ink/8" : ""
                      }`}
                    >
                      <code className="w-fit text-[10px]">{row.event}</code>
                      <span className="text-[11.5px] leading-relaxed text-ink/50">
                        {row.invalidates}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-ink/10 border-l-2 border-l-accent bg-white/60 p-4">
                  <p className="flex items-center gap-2 text-[12px] font-medium text-ink/75">
                    <ShieldCheck className="h-3.5 w-3.5 text-accent-deep" />
                    Pages are cleared on your store first
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink/50">
                    Clearing happens on your own server the moment WooCommerce reports the change,
                    before Silo is contacted. If Silo is unreachable, or the monthly event allowance
                    is used up, stock and prices still stay correct; only warmup and logging wait.
                  </p>
                </div>
              </section>

              <section id="hooks" className="mt-16 scroll-mt-28">
                <SectionTitle number="04" title="Developer hooks" />
                <p className="mt-3 text-[14px] leading-relaxed text-ink/55">
                  Add pages Silo should refresh, or run your own code after Silo clears a product.
                  Put these in a small plugin or your theme&apos;s functions.php. For pages that
                  are always the same, such as a bestsellers page, you don&apos;t need code: list
                  them under WooCommerce → Silo → Settings → Also refresh these pages.
                </p>
                <p className="mt-5 text-[13px] font-medium text-ink/75">silo_extra_urls (filter): extra pages to clear and rewarm for a product</p>
                <Code>{`add_filter( 'silo_extra_urls', function ( $urls, $product_id, $product ) {
    // Refresh the new-products page only for products under 30 days old.
    $created = $product->get_date_created();
    if ( $created && $created->getTimestamp() > time() - 30 * DAY_IN_SECONDS ) {
        $urls[] = home_url( '/new-products/' );
    }
    return $urls;
}, 10, 3 );`}</Code>
                <p className="mt-5 text-[13px] font-medium text-ink/75">silo_invalidated (action): runs after Silo clears a change&apos;s pages</p>
                <Code>{`add_action( 'silo_invalidated', function ( $product_ids, $urls, $type ) {
    // $type is e.g. stock.changed, order.stock_reduced, price.updated.
    foreach ( $product_ids as $id ) {
        my_refresh_stock_message( $id ); // your own code
    }
}, 10, 3 );`}</Code>
                <p className="mt-4 text-[13px] leading-relaxed text-ink/55">
                  Also available: <code>silo_brand_taxonomies</code> to add a custom brand taxonomy,
                  and <code>silo_layout_post_types</code> for post types whose changes should refresh
                  every page.
                </p>
              </section>

              <section id="troubleshooting" className="mt-16 scroll-mt-28">
                <SectionTitle number="05" title="Troubleshooting" />
                <div className="mt-5 divide-y divide-ink/10 border-y border-ink/10">
                  {TROUBLE.map((item) => (
                    <details key={item.q} className="group">
                      <summary className="flex items-start justify-between gap-4 py-4 text-left">
                        <span className="text-[13px] font-medium text-ink">{item.q}</span>
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ink/12 text-ink/35 transition group-open:rotate-45 group-open:text-accent-deep">
                          <Plus className="h-3 w-3" />
                        </span>
                      </summary>
                      <p className="max-w-[680px] pb-5 text-[12.5px] leading-[1.7] text-ink/50">
                        {item.a}
                      </p>
                    </details>
                  ))}
                </div>
              </section>

              <section id="support" className="mt-16 scroll-mt-28">
                <SectionTitle number="06" title="Limits & support" />
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Catalog events", value: "100k / 500k / 2M", note: "per month, shared by your stores" },
                    { label: "Warmup per change", value: "up to 150 / 500 / 1,500", note: "pages" },
                    { label: "Event log retention", value: "30 / 90 / 180", note: "days" },
                    { label: "Support", value: "Email → dedicated", note: "by plan" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg border border-ink/10 bg-white/50 p-4">
                      <p className="font-mono text-[8px] uppercase tracking-[0.08em] text-ink/30">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[13.5px] font-medium text-ink">{item.value}</p>
                      <p className="mt-0.5 font-mono text-[9px] text-ink/30">{item.note}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[12px] leading-relaxed text-ink/45">
                  Need the exact plan limits?{" "}
                  <Link href="/pricing" className="font-medium text-ink underline underline-offset-2">
                    Pricing has the full table
                  </Link>
                  . For a connector incident, include the store URL, request ID and timestamp.
                </p>

                <div className="mt-8 flex flex-col justify-between gap-4 rounded-xl bg-ink p-6 text-paper sm:flex-row sm:items-center">
                  <div>
                    <p className="text-[14px] font-medium">Ready to connect a store?</p>
                    <p className="mt-1 text-[11.5px] text-paper/40">
                      Four minutes, one key, no DNS change.
                    </p>
                  </div>
                  <ConnectButton>Connect your store</ConnectButton>
                </div>
              </section>

              <p className="mt-10 flex items-center gap-2 border-t border-ink/10 pt-4 font-mono text-[9px] text-ink/30">
                <Terminal className="h-3 w-3" />
                Last updated November 27, 2026{connector ? ` · connector ${connector}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-ink/10 pb-3">
      <span className="font-mono text-[9px] tracking-[0.1em] text-accent-deep">{number}</span>
      <h2 className="font-display text-[26px] font-medium tracking-[-0.03em] text-ink">
        {title}
      </h2>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-l border-ink/10 pl-5">
      <span className="absolute -left-[13px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-ink/10 bg-paper font-mono text-[9px] text-ink/45">
        {number}
      </span>
      <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
      <div className="mt-2 space-y-3 text-[13px] leading-[1.7] text-ink/55 [&_code]:font-mono [&_code]:text-[0.88em] [&_code]:text-ink/80 [&_strong]:font-medium [&_strong]:text-ink/75">
        {children}
      </div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="code-block">
      <code>{children}</code>
    </pre>
  );
}
