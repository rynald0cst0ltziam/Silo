export type Plan = {
  name: string;
  price: number;
  annual: number;
  stores: number;
  storeLabel: string;
  tagline: string;
  events: string;
  features: string[];
  popular?: boolean;
};

export const PLANS: Plan[] = [
  {
    name: "Solo",
    price: 29,
    annual: 290,
    stores: 1,
    storeLabel: "1 store",
    tagline: "For one catalog that has to stay exact.",
    events: "100,000 catalog events / month",
    features: [
      "1 isolated store environment",
      "Unlimited products and variations",
      "Full surgical invalidation engine",
      "Priority warmup — 50 URLs per event",
      "Currency, language and geo-aware cache keys",
      "Works alongside your cache plugin, host and Cloudflare",
      "30-day invalidation log",
      "Email support",
    ],
  },
  {
    name: "Studio",
    price: 79,
    annual: 790,
    stores: 3,
    storeLabel: "3 stores",
    tagline: "For teams running a family of storefronts.",
    events: "500,000 catalog events / month, shared",
    features: [
      "Everything in Solo, for 3 stores",
      "Per-store isolation and keys",
      "Priority warmup — 250 URLs per event",
      "90-day invalidation log",
      "One account and one invoice for 3 stores",
      "Priority email support",
    ],
    popular: true,
  },
  {
    name: "Portfolio",
    price: 149,
    annual: 1490,
    stores: 5,
    storeLabel: "5 stores",
    tagline: "For multi-region, multi-currency catalogs.",
    events: "2,000,000 catalog events / month, shared",
    features: [
      "Everything in Studio, for 5 stores",
      "Priority warmup — 500 URLs per event",
      "180-day invalidation log",
      "Guided connector onboarding",
      "Dedicated support channel",
    ],
  },
];

export type Faq = { q: string; a: string };

export const PRICING_FAQS: Faq[] = [
  {
    q: "Will Silo break my cart or checkout?",
    a: "No. Cart, checkout, my-account, and any request carrying a WooCommerce session cookie are never stored in the shared cache. They pass straight through. This is enforced on your server before a cache key is built — there is nothing to configure and no exclusion list to maintain.",
  },
  {
    q: "What happens to my existing cache plugin?",
    a: "Keep it. When WP Rocket, LiteSpeed Cache, W3 Total Cache, FlyingPress or another page cache is active, Silo works alongside it: that plugin keeps serving pages, and Silo tells it exactly which pages to purge whenever stock, prices, sales or orders change, then rewarms them. Asset optimization, lazy loading and CDN features stay as they are. Host caches and Cloudflare are purged in step too.",
  },
  {
    q: "Is it compatible with HPOS?",
    a: "Yes. Silo listens to the HPOS order and stock events as well as the legacy postmeta paths. Stock reductions from orders, refunds, and manual edits all resolve to the same product and variation nodes, so the invalidation result is identical regardless of where your order data lives.",
  },
  {
    q: "Do I need to configure a purge list?",
    a: "No. The connector sends Silo the store's catalog graph — products, variations, categories, tags, attributes, permalinks, and Store API routes. When something changes, Silo walks that graph. You can add protected URLs or pin pages in warmup, but the core invalidation requires no rules.",
  },
  {
    q: "Does it work with multisite?",
    a: "Each subsite gets its own store key and its own isolated cache namespace. Sites cannot read or purge each other's entries. On Portfolio, up to five subsites or separate stores can be connected under one account.",
  },
  {
    q: "What happens if the connector goes offline?",
    a: "Silo fails closed. Correctness never depends on reaching Silo: the connector purges the affected pages on your server the moment WooCommerce reports a change, then sends the event as soon as the connection allows. If the connector is deactivated or disconnected, Silo rejects the store key, or the plan lapses, cached pages stop being served immediately and every request goes straight to WooCommerce. Stale stock is worse than a slower page, so we choose the origin every time.",
  },
  {
    q: "Can I cancel or get a refund?",
    a: "Yes. Start with a 3-day trial, no card required. Cancel any time from Billing in the dashboard; monthly plans stay active to the end of the paid period and annual plans are refundable within 30 days. See the refund policy for the details.",
  },
];

export type FaqGroup = {
  id: string;
  title: string;
  description: string;
  items: Faq[];
};

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "correctness",
    title: "Correctness and privacy",
    description: "The rules that keep stock honest and shopping sessions private.",
    items: [
      {
        q: "Is Silo a general WordPress cache?",
        a: "No. Silo is a cache for WooCommerce catalog traffic, not a general-purpose page cache for a content site. The connector maps products, variations, archives and Store API routes, then keeps those public responses warm. It does not cache wp-admin, feeds, checkout, or any request that depends on who is asking.",
      },
      {
        q: "Are cart, checkout and account requests ever cached?",
        a: "Never. A request carrying a WooCommerce session cookie, cart token, nonce, Authorization header, or authenticated user is forwarded to the origin before a shared cache key is built. There is no exclusion list to maintain and no cart state in shared storage.",
      },
      {
        q: "Will stale stock ever be served after a change?",
        a: "Silo is built so stale stock is the exception, not the default. Stock reductions, refunds and manual edits resolve to a product or variation node and invalidate every response that depends on it. Every change is purged on your server immediately, even if Silo itself is unreachable, and Silo then re-warms the affected pages.",
      },
      {
        q: "How are variable products handled?",
        a: "The connector diffs the variation matrix cell by cell. One size selling out invalidates that variation, the parent stock summary, the dropdown payload and the archives that contain the product. The other 23 unchanged variations stay warm. There is no blanket parent purge for a single-cell change.",
      },
      {
        q: "What happens if the connector goes offline?",
        a: "Silo fails closed. Correctness never depends on reaching Silo: the connector purges the affected pages on your server the moment WooCommerce reports a change, then sends the event as soon as the connection allows. If the connector is deactivated or disconnected, Silo rejects the store key, or the plan lapses, cached pages stop being served immediately and every request goes straight to WooCommerce. The dashboard shows when the connector last checked in.",
      },
      {
        q: "What data leaves my store?",
        a: "Catalog structure and cache statistics only: product IDs, names, SKUs, permalinks, product types, stock status and prices for the products that changed, plus hit, miss and warmup counts. Order events carry the order number and the affected products, never customer names, addresses, emails, payment details or cart contents. Every request is signed with HMAC-SHA256; the store key itself is never sent, only a hash that identifies it.",
      },
    ],
  },
  {
    id: "invalidation",
    title: "Invalidation and performance",
    description: "How one catalog change becomes a precise set of cleared and re-warmed responses.",
    items: [
      {
        q: "How is this different from a full-page purge?",
        a: "A full-page purge starts with a URL and clears anything that might be related. Silo starts with the catalog fact that changed, follows its edges through categories, attribute archives, variation payloads and Store API filter combinations, then invalidates only those responses. Everything else stays warm.",
      },
      {
        q: "Do I need to maintain a purge list or exclusion rules?",
        a: "No. The connector sends Silo the store's catalog graph, including products, variations, categories, tags, attributes, permalinks and Store API routes. You can protect individual URLs or pin pages for warmup, but the core invalidation requires no manual rules.",
      },
      {
        q: "Does it cache Store API and Product Blocks responses?",
        a: "Yes. Anonymous GET responses from mapped Store API product collection routes are cached per filter combination, and Product Blocks that read through those routes benefit from the same entries. A stock change invalidates only the cached filter sets that can contain the affected product. Cart and checkout routes never enter the cache.",
      },
      {
        q: "How fast is invalidation?",
        a: "The graph walk usually completes in tens of milliseconds. Re-warming priority pages happens asynchronously afterward, so shoppers never wait for the origin to rebuild a page. Invalidation speed and origin speed are separate numbers in the dashboard.",
      },
      {
        q: "Does it support currencies, languages and geo pricing?",
        a: "Yes, on every plan. The scan detects WPML, Polylang, TranslatePress and Weglot, and WooCommerce Multilingual, WOOCS, CURCY, Aelia and YayCurrency, and adds language or currency to the cache key when a store uses them. Stores that price by visitor country are keyed by the country your CDN or host reports; if none is reported, those pages are not cached rather than risk the wrong price. A product change purges every variant of its page in one step.",
      },
    ],
  },
  {
    id: "setup",
    title: "Setup and compatibility",
    description: "What it takes to put Silo in front of an existing WooCommerce store.",
    items: [
      {
        q: "What does Silo require?",
        a: "WordPress 6.4+, WooCommerce 8.2+, PHP 8.1+ and outbound HTTPS from the store. You install one connector plugin and paste a store key. No DNS change, proxy, theme rewrite or server access is required.",
      },
      {
        q: "Which plugins, hosts and builders does Silo work with?",
        a: "Cache plugins: WP Rocket, LiteSpeed Cache, W3 Total Cache, WP Super Cache, WP Fastest Cache, FlyingPress, SiteGround Optimizer, Hummingbird, Cache Enabler and WP-Optimize (Silo works alongside them and purges their cache in step). Hosts and CDN: Cloudflare, Kinsta, WP Engine, Pantheon, SpinupWP and Nginx Helper. Page builders and themes: Elementor, Beaver Builder, Divi, Bricks, Oxygen, Breakdance, block themes, Astra, Kadence, GeneratePress, Blocksy and Flatsome. Languages and currencies: WPML, Polylang, TranslatePress, Weglot, WooCommerce Multilingual, WOOCS, CURCY, Aelia and YayCurrency. Platform: WooCommerce 8.2+, WordPress 6.4+, PHP 8.1+, HPOS and legacy orders, block cart and checkout, Product Blocks, the Store API and multisite.",
      },
      {
        q: "Does it work with Cloudflare and my host's cache?",
        a: "Yes. Host caches on Kinsta, WP Engine, Pantheon and SpinupWP, and Nginx Helper setups, are detected and purged in step with Silo. For Cloudflare caching (APO or cache rules), add your zone ID and an API token with Cache Purge permission under WooCommerce → Silo → Settings → Other caches and CDN; Silo then purges the same pages at Cloudflare.",
      },
      {
        q: "Can I keep WP Rocket or FlyingPress?",
        a: "Yes. Silo switches to work-alongside mode automatically: your cache plugin serves pages, Silo purges exactly the affected product, category and shop pages in it on every catalog change (including stock changes from orders and scheduled sales, which page caches usually miss), then rewarms them. If you would rather Silo serve pages, pick Silo serves pages in its settings and turn off only the other plugin's page cache.",
      },
      {
        q: "Does Silo work with Elementor and other page builders?",
        a: "Yes. Elementor, Beaver Builder, Divi, Bricks, Oxygen and Breakdance pages are cached like any other. When you save a product layout, only that product is purged; when you change a header, footer or theme template, or regenerate builder CSS, every cached page is refreshed so nothing references old styles.",
      },
      {
        q: "Is HPOS supported?",
        a: "Yes. Silo listens to HPOS order and stock events as well as the legacy postmeta paths. Stock reductions from orders, refunds and manual edits resolve to the same product and variation nodes, so invalidation is identical regardless of where order data lives.",
      },
      {
        q: "Does it work with multisite?",
        a: "Each subsite gets its own Silo store key, cache namespace and invalidation graph. Sites cannot read or purge each other's entries. On Portfolio, up to five subsites or separate stores can be connected under one account.",
      },
      {
        q: "Will it work with my theme?",
        a: "If the storefront is rendered through standard WooCommerce templates and hooks, Silo can cache it, including block themes and Astra, Kadence, GeneratePress, Blocksy and Flatsome layouts. Themes that read the catalog through custom AJAX endpoints need a short review first. The connector scan reports any catalog routes it cannot map, so nothing is assumed silently.",
      },
      {
        q: "How long does setup take?",
        a: "About four minutes for a typical store: add the store, install the connector, paste the key and run the scan. Large catalogs take longer to map, but the storefront can go live after the initial scan while warmup continues in the background.",
      },
      {
        q: "What happens when I deactivate or delete the connector?",
        a: "Deactivating removes the advanced-cache.php drop-in, the WP_CACHE line in wp-config.php (only if Silo added it), every scheduled task and all cached files, so nothing stale can be served. Deleting the plugin also removes its settings, its two database tables and the wp-content/cache/silo folder. A drop-in owned by another plugin is never touched.",
      },
    ],
  },
  {
    id: "day-to-day",
    title: "Using Silo day to day",
    description: "What the numbers mean and how to tell Silo is doing its job.",
    items: [
      {
        q: "How do I check that Silo is working?",
        a: "Open a product page in a private window and look at the x-silo-cache response header: MISS on the first visit, HIT after that. In WordPress, WooCommerce → Silo → Status → Run live checks requests the shop page twice and shows the same round trip, along with the drop-in, connection and other-cache checks. If Silo is working alongside another cache plugin, that plugin serves the pages, so check its own header or HTML comment instead; the Status tab tells you which mode the store is in.",
      },
      {
        q: "What does the hit rate measure?",
        a: "The share of anonymous requests to WooCommerce pages (product pages, the shop and product archives) that were served from cache. Visitors with a cart or a login are never cached, so they are counted separately as bypassed instead of lowering the hit rate. The first visit to every page and variant renders fresh, so a quiet store climbs slowly; Purge all resets the counters on both sides. When Silo works alongside another page cache, that plugin serves the pages, so the dashboard shows which cache is serving and the Store API hit rate instead.",
      },
      {
        q: "Why does a page sometimes show MISS or STALE?",
        a: "MISS means the page was rendered and stored on this request: the first visit, the first visit on mobile or in another currency, or the first visit after the product changed. STALE means the entry passed its time limit and was served once more while it re-renders in the background. BYPASS means the visitor has a cart, session or login, so the page is always live.",
      },
      {
        q: "What is warmup doing?",
        a: "After a change, Silo picks the pages that matter most (the product, the shop, its categories and your bestsellers) and the connector requests them from your own server for desktop and mobile, in the background, so the next shopper gets a cached page. The Warmup tab shows every URL as queued, warming, warm or failed, with how long it took. The number of URLs per event depends on your plan.",
      },
      {
        q: "What does the catalog scan do? Does it change anything?",
        a: "It reads your catalog: product types, variations, stock, categories, tags, brands, attribute archives, Store API routes and bestsellers. It changes nothing on the store and requests no pages. Silo turns the result into the store's cache profile. You can run it again at any time from Catalog in either dashboard.",
      },
      {
        q: "Do scheduled sale prices update on time?",
        a: "Yes. WooCommerce only processes scheduled sales once a day, so a cached page could show the old price after a sale starts or ends. Silo schedules a purge for each product at the exact moment its sale starts and ends, plus a safety pass shortly afterwards.",
      },
      {
        q: "Do logged-in customers see cached pages?",
        a: "No. Logged-in customers, shoppers with something in their cart and anyone with a WooCommerce session always get a live page, so prices, stock, wishlists and account details are always theirs.",
      },
      {
        q: "Can I export my data?",
        a: "Yes. In WordPress, the Invalidations and Warmup tabs export CSV, and Status exports the cache list as CSV and a full diagnostics report as JSON. The Silo dashboard exports the cached page list. The diagnostics file is the fastest way to get help from support.",
      },
    ],
  },
  {
    id: "plans",
    title: "Plans and billing",
    description: "Store counts, event limits and what happens when the catalog grows.",
    items: [
      {
        q: "What counts as a store?",
        a: "One WordPress and WooCommerce installation with its own Silo key and cache namespace. On multisite, each connected subsite counts as one store. A staging copy of the same store also needs its own key if you want to cache it.",
      },
      {
        q: "What is an invalidation event?",
        a: "One accepted catalog change that triggers a graph walk: a stock reduction, price change, product edit, refund or attribute term update. A page view or cache hit is not an invalidation, and warmup fetches are tracked separately from the event allowance.",
      },
      {
        q: "Is there a trial?",
        a: "Yes. Every account starts with a 3-day trial and no card is required. The trial covers one store with Solo limits (100,000 events, 50 warmup URLs per event) and the full engine, not a reduced preview. Choose a plan any time from Billing: if more than two days are left, billing starts when the trial ends; otherwise it starts the day you subscribe. If the trial ends without a plan, caching pauses on the store (it never serves stale pages) and switches back on the moment a plan starts.",
      },
      {
        q: "Can I change plans later?",
        a: "Yes. Billing → Change plan opens the secure Stripe portal, where you can switch plans or billing interval; Stripe prorates the difference. If you move to a plan with fewer stores, your oldest stores stay active up to the new limit and the rest pause until you remove a store or upgrade.",
      },
      {
        q: "Where do I find invoices, usage and account activity?",
        a: "Billing shows your plan, renewal date, usage this month and every invoice with a PDF. Activity lists sign-ins, password and billing changes and store actions with time and IP address. Account lets you change your name, email and password, sign out of every browser or delete the account, which cancels the subscription immediately.",
      },
      {
        q: "How do refunds work?",
        a: "Annual plans are refundable within 30 days. Monthly plans can be cancelled at any time and remain active through the paid period. The refund policy covers the details, including what happens to store data after cancellation.",
      },
      {
        q: "What support is included?",
        a: "Email support is included on Solo, priority email on Studio, and a dedicated channel on Portfolio. Support comes from the team that builds the connector, not a generic call center.",
      },
    ],
  },
];

export type ComparisonCell = {
  value: string;
  tone: "good" | "bad" | "mixed";
};

export type ComparisonRow = {
  label: string;
  detail: string;
  rocket: ComparisonCell;
  flying: ComparisonCell;
  silo: ComparisonCell;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Invalidation scope",
    detail: "What gets cleared after a catalog change",
    rocket: { value: "Full page cache purge", tone: "bad" },
    flying: { value: "Full purge or manual rules", tone: "bad" },
    silo: { value: "Product-level graph walk", tone: "good" },
  },
  {
    label: "Variation-aware",
    detail: "Treats each variation as its own cache node",
    rocket: { value: "No", tone: "bad" },
    flying: { value: "No", tone: "bad" },
    silo: { value: "Yes, per variation", tone: "good" },
  },
  {
    label: "Order-driven stock",
    detail: "Reacts to reductions, refunds and HPOS events",
    rocket: { value: "Broad purge", tone: "mixed" },
    flying: { value: "Broad purge", tone: "mixed" },
    silo: { value: "Targeted invalidation", tone: "good" },
  },
  {
    label: "Category mapping",
    detail: "Knows which archives contain a product",
    rocket: { value: "Manual", tone: "bad" },
    flying: { value: "Manual", tone: "bad" },
    silo: { value: "Automatic", tone: "good" },
  },
  {
    label: "Store API & Blocks",
    detail: "Handles product collection and filter endpoints",
    rocket: { value: "Partial", tone: "mixed" },
    flying: { value: "Partial", tone: "mixed" },
    silo: { value: "Native route mapping", tone: "good" },
  },
  {
    label: "Automatic re-warm",
    detail: "Rebuilds priority pages after invalidation",
    rocket: { value: "No", tone: "bad" },
    flying: { value: "Limited", tone: "mixed" },
    silo: { value: "Scored priority queue", tone: "good" },
  },
  {
    label: "Cart & checkout safety",
    detail: "Never stores session-bearing requests",
    rocket: { value: "Configured exclusions", tone: "mixed" },
    flying: { value: "Configured exclusions", tone: "mixed" },
    silo: { value: "Enforced by default", tone: "good" },
  },
  {
    label: "Works with other caches",
    detail: "Runs next to an existing page cache or CDN",
    rocket: { value: "Replaces others", tone: "mixed" },
    flying: { value: "Replaces others", tone: "mixed" },
    silo: { value: "Runs alongside, purges them", tone: "good" },
  },
  {
    label: "Setup",
    detail: "Time to a correctly cached storefront",
    rocket: { value: "15–30 minutes", tone: "mixed" },
    flying: { value: "15–30 minutes", tone: "mixed" },
    silo: { value: "About 4 minutes", tone: "good" },
  },
];

export const TESTIMONIALS = [
  {
    quote:
      "We stopped waking up to oversold variants. The first week, Silo caught a stock reduction from an HPOS order that our old setup would have left on the product page until TTL.",
    name: "Elena Marsh",
    role: "Head of Ecommerce",
    context: "Home & living · 4,200 SKUs",
  },
  {
    quote:
      "Our launch nights used to end with a full purge and 40 minutes of warmup. Now a price change touches one product, two collections and the Store API route. That is the whole event.",
    name: "Tomas Ried",
    role: "CTO",
    context: "Outdoor goods · 12,000 SKUs, 6 currencies",
  },
  {
    quote:
      "The invalidation log is the part I did not expect to use every day. I can finally answer 'why did this page change?' without guessing which plugin fired.",
    name: "Priya Nandakumar",
    role: "Founder",
    context: "Independent label · 1,800 SKUs",
  },
];

export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; code: string; caption?: string }
  | { type: "quote"; text: string }
  | { type: "callout"; title: string; text: string };

export type Post = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  readingTime: string;
  lede: string;
  blocks: Block[];
};

export const POSTS: Post[] = [
  {
    slug: "variable-product-invalidation",
    title: "How we handle variable product invalidation",
    description:
      "A variable product is not one cache entry. Here is how Silo diffs the variation matrix, resolves attribute URLs and invalidates only the nodes that changed.",
    category: "Engineering",
    date: "2026-10-28",
    readingTime: "7 min read",
    lede:
      "A product with 4 colors and 6 sizes is 24 variations, one parent page, up to 24 variation payloads, and every archive the product appears in. Invalidating the parent URL is the easy part. The rest is where generic caches leave stale stock behind.",
    blocks: [
      {
        type: "p",
        text: "When a shopper changes the color dropdown on a variable product, WooCommerce does not load a new page. It sends an AJAX request, receives a JSON payload, and rewrites the price, image, SKU and stock message in place. A page cache that only thinks in URLs never sees that request. It caches the parent HTML, serves it happily, and the variation panel quietly offers a size that sold out an hour ago.",
      },
      { type: "h2", text: "The variation matrix is the unit of change" },
      {
        type: "p",
        text: "Silo models every variable product as a matrix: attributes on one axis, variations and their stock status on the other. The connector sends a compact hash of that matrix, not the whole catalog, every time WooCommerce fires a variation or stock event. When the hash changes, Silo asks a narrower question: which cells actually moved?",
      },
      {
        type: "code",
        code: `product: 1042  aster-linen-shirt
attributes: color[olive, ecru, ink] x size[sm, md, lg]

before   after
olive/sm  in_stock  ->  in_stock
olive/md  in_stock  ->  out_of_stock   *
olive/lg  in_stock  ->  in_stock
ecru/sm   in_stock  ->  in_stock`,
        caption: "Only the olive/md cell changed. Only its nodes are invalidated.",
      },
      { type: "h2", text: "Diff the matrix, not the product" },
      {
        type: "p",
        text: "A naive implementation purges the product page whenever any variation changes. That is safe but wasteful: a single size selling out would clear the same page a hundred times during a drop. Silo diffs the matrix first, then resolves the exact set of dependent cache nodes for the cells that changed.",
      },
      {
        type: "ul",
        items: [
          "The parent product URL, because the stock summary and schema markup can change.",
          "The variation JSON or AJAX endpoint, because the dropdown payload must not lie.",
          "Any attribute archive whose filtered set includes an out-of-stock variation, when the store hides out-of-stock items.",
          "Category, tag and brand archives that contain the parent product.",
          "Store API product collection routes whose filters match the changed variation.",
        ],
      },
      {
        type: "p",
        text: "All of that happens from one event. The shopper's cart is untouched, the rest of the catalog stays warm, and the origin sees one targeted request instead of a crawl.",
      },
      { type: "h2", text: "The edge cases that actually bite" },
      {
        type: "p",
        text: "Most stale-stock bugs are not in the happy path. They are in the events that arrive out of order, or the settings that change the meaning of the catalog without changing a product. Silo handles these explicitly:",
      },
      {
        type: "ul",
        items: [
          "A variation is deleted while its parent remains published: the parent and every archive containing it are invalidated, and the variation payload is served fresh.",
          "The default variation changes: the parent page and the variation payload are re-keyed, even though stock did not move.",
          "Backorders are enabled or a stock threshold changes: the product's effective availability changes without a quantity event, so the catalog hash includes stock settings.",
          "An attribute term is renamed: every product using that term gets a new permalink and new filtered archive URLs. Silo re-maps before purging.",
          "A refund restores stock through HPOS: the order event resolves to the same variation node as a reduction. The path through WooCommerce differs; the result does not.",
        ],
      },
      { type: "h2", text: "What about currency, language and geo?" },
      {
        type: "p",
        text: "Those are cache keys, not separate catalogs. Silo stores the variation matrix once and varies the rendered response by currency, locale and tax display settings. When a price changes, the invalidation walks the keys for that product rather than the whole country. If you run six currencies, one price edit clears six product renderings and the archives that show that product — still a bounded set.",
      },
      {
        type: "callout",
        title: "The rule we design against",
        text: "No cached storefront response should outlive the catalog fact it depends on. The job is not to purge quickly. The job is to know exactly which facts changed.",
      },
      {
        type: "p",
        text: "That is the whole architecture. It is also why a generic page cache cannot get here by adding a setting: the product graph has to exist before the purge can be surgical.",
      },
    ],
  },
  {
    slug: "cost-of-a-full-purge",
    title: "What a full-page purge actually costs",
    description:
      "Full purges look instant in the admin. The bill arrives later, as origin load, slow first shoppers and warmup debt. A look at the real cost of clearing everything.",
    category: "Performance",
    date: "2026-10-12",
    readingTime: "5 min read",
    lede:
      "The purge button returns in 200 milliseconds, so it feels free. Everything expensive happens afterward: the origin sees the next hundred requests, the first shoppers absorb the latency, and the warmup queue becomes a background tax on every catalog edit.",
    blocks: [
      {
        type: "p",
        text: "A full purge is a bet that the set of pages affected by a change is unknowable. On a blog, that bet is usually fine. On a store with 40,000 products, it is a recurring outage you schedule yourself.",
      },
      { type: "h2", text: "The first shopper pays for the purge" },
      {
        type: "p",
        text: "After a full purge, the next request to each URL is a cache miss. The origin renders the page, queries the database, assembles the cart fragments and returns HTML. If the URL is a category page with filters, that can take hundreds of milliseconds to seconds. The shopper who arrives first waits for all of it. The cache is only fast once someone else has already paid.",
      },
      {
        type: "p",
        text: "During a product drop, every stock change can fire another purge. Shoppers and the warmer then compete for the same PHP workers. The origin gets slower exactly when traffic is highest, which is the opposite of what a cache is for.",
      },
      { type: "h2", text: "Warmup debt compounds" },
      {
        type: "p",
        text: "Warmers help, but they do not make a full purge cheap. They move the cost from the shopper to the server, and the server still has to render every page. A 20,000-URL catalog at 300ms per render is over an hour of continuous work. If another purge lands in the middle, the queue restarts or duplicates.",
      },
      {
        type: "ul",
        items: [
          "A 20,000-URL catalog takes about 100 minutes to warm at 300ms per page.",
          "Each purge resets or duplicates part of that queue.",
          "Repeated purges keep the origin at sustained load, which is when PHP workers and database connections run out.",
          "The tail latency is what shoppers feel, and it is worse on mobile and on category pages.",
        ],
      },
      { type: "h2", text: "Surgical invalidation changes the shape of the bill" },
      {
        type: "p",
        text: "If one stock change touches five URLs instead of twenty thousand, warmup takes seconds. The origin sees a small, predictable burst. The queue stays short enough that every event can be fully re-warmed before the next one arrives. The cache hit rate stops collapsing on the days that matter most.",
      },
      {
        type: "quote",
        text: "The goal is not a faster full purge. It is not needing one.",
      },
      {
        type: "p",
        text: "That is why Silo invests in the catalog graph instead of a faster crawler. The expensive part of a cache is not storage. It is correctness at the edges, when something changes.",
      },
    ],
  },
  {
    slug: "store-api-cache-boundary",
    title: "Store API, Blocks, and the cache boundary",
    description:
      "Cart and Checkout Blocks talk to the Store API. Where does a page cache end and a session-aware endpoint begin? A practical boundary for WooCommerce caching.",
    category: "Engineering",
    date: "2026-09-26",
    readingTime: "6 min read",
    lede:
      "WooCommerce Blocks moved a lot of storefront behavior into JSON requests. That is good for building checkout flows and bad for caches that only know how to purge HTML URLs. The boundary has to be explicit.",
    blocks: [
      {
        type: "p",
        text: "A modern WooCommerce storefront is not a set of static pages. Product collection blocks request filtered product lists, the Mini-Cart block asks for cart state, and Checkout requests shipping and payment data. Each of those is a Store API request, and each has a different caching answer.",
      },
      { type: "h2", text: "Three classes of Store API request" },
      {
        type: "ol",
        items: [
          "Catalog reads. Product collections, category filters, price sort, attribute filters. These are public, cacheable, and expensive to recompute. They should be keyed by the full filter set and invalidated when a product in the result changes.",
          "Cart reads. Anything derived from the shopper's session or cart token. Never shared, never stored in the cache, always forwarded.",
          "Checkout and account reads. Nonces, addresses, payment methods, order state. Never cached, and never allowed to influence a shared cache key.",
        ],
      },
      {
        type: "p",
        text: "Most cache bugs at the Store API boundary come from treating class 2 or 3 like class 1, or from caching class 1 without including filters in the key. A filtered archive and the unfiltered archive are not the same response.",
      },
      { type: "h2", text: "Mapping routes to the catalog graph" },
      {
        type: "p",
        text: "Silo's connector asks WooCommerce for the Store API route table and maps each product collection route to the filters it accepts: category, tag, attribute, stock status, price, search, orderby. That mapping lets an invalidation answer the only question that matters: which cached filter combinations could contain this product?",
      },
      {
        type: "code",
        code: `GET /wp-json/wc/store/v1/products?category=shirts&stock_status=instock
  -> key: category:shirts | stock:instock | currency:EUR | locale:en

stock change: olive/md out_of_stock
  -> invalidate collection keys with stock_status=instock
     and category in [shirts, new] and attribute color=olive`,
        caption: "Filter combinations are bounded cache nodes, not query strings to be replayed.",
      },
      {
        type: "p",
        text: "The connector sends filter changes with the event. Silo does not need to replay arbitrary query strings against the origin, and it does not need to purge every product collection on the site. It resolves the combinations it has actually cached.",
      },
      { type: "h2", text: "Cart fragments are not a cache problem" },
      {
        type: "p",
        text: "WooCommerce's cart fragments endpoint is a frequent source of shared-cache leaks. It returns markup that contains the shopper's cart. The right answer is not a smarter TTL; it is to keep the request out of the shared cache entirely. Silo treats any request with a WooCommerce session cookie, cart token, nonce in the path, or an authenticated user as private and forwards it.",
      },
      {
        type: "callout",
        title: "The boundary, stated simply",
        text: "Public catalog reads can be shared. Anything that depends on who is asking cannot. The connector enforces this before a cache key is built, not in a settings screen.",
      },
      {
        type: "p",
        text: "That means Blocks and classic shortcodes can coexist. The page HTML is cached for anonymous shoppers; the interactive parts are fetched from a boundary that never shares state. The cart stays yours, the catalog stays fast, and there is no exclusion list to drift out of date.",
      },
    ],
  },
];

export type ChangelogEntry = {
  version: string;
  date: string;
  title: string;
  items: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.9.0",
    date: "2026-11-11",
    title: "Store API route mapping and warmup scoring v2",
    items: [
      "Store API product collection routes are now mapped to catalog filters and invalidated per combination.",
      "Warmup priority now accounts for revenue rank, entry traffic and archive depth, not just URL depth.",
      "Refund events from HPOS restore stock to the correct variation node.",
    ],
  },
  {
    version: "0.8.2",
    date: "2026-10-19",
    title: "Variation matrix diffing",
    items: [
      "Variable products are diffed cell by cell; unchanged variations no longer trigger a parent purge.",
      "Attribute term renames now re-map filtered archives before invalidation.",
      "Connector heartbeat exposes catalog graph version in the dashboard.",
    ],
  },
  {
    version: "0.8.0",
    date: "2026-09-30",
    title: "Connector public beta",
    items: [
      "One-line install, store key pairing and catalog scan.",
      "Edge invalidation log with trigger, scope and re-warm state.",
      "Cart, checkout and account requests are excluded by default.",
    ],
  },
];

export type CompatibilityGroup = { title: string; note: string; items: string[] };

/** Everything the connector detects and handles. Keep in sync with Silo_Compat and the scanner. */
export const COMPATIBILITY_GROUPS: CompatibilityGroup[] = [
  {
    title: "Platform",
    note: "Minimums the connector checks on install.",
    items: ["WooCommerce 8.2+", "WordPress 6.4+", "PHP 8.1+", "HPOS and legacy orders", "Block cart and checkout", "Product Blocks", "Store API", "Multisite"],
  },
  {
    title: "Cache plugins",
    note: "Silo works alongside them and purges their cache in step.",
    items: ["WP Rocket", "LiteSpeed Cache", "W3 Total Cache", "WP Super Cache", "WP Fastest Cache", "FlyingPress", "SiteGround Optimizer", "Hummingbird", "Cache Enabler", "WP-Optimize"],
  },
  {
    title: "Hosts and CDN",
    note: "Edge copies of changed pages are cleared too.",
    items: ["Cloudflare", "Kinsta", "WP Engine", "Pantheon", "SpinupWP", "Nginx Helper"],
  },
  {
    title: "Page builders and themes",
    note: "Layout and template changes refresh the right pages.",
    items: ["Elementor", "Beaver Builder", "Divi", "Bricks", "Oxygen", "Breakdance", "Block themes", "Astra", "Kadence", "GeneratePress", "Blocksy", "Flatsome"],
  },
  {
    title: "Languages and currencies",
    note: "Detected by the scan and added to the cache key.",
    items: ["WPML", "Polylang", "TranslatePress", "Weglot", "WooCommerce Multilingual", "WOOCS", "CURCY", "Aelia", "YayCurrency"],
  },
];

export const COMPATIBILITY = COMPATIBILITY_GROUPS.flatMap((g) => g.items);
