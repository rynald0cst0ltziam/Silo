# Silo — Full Build Plan v1.1 (Amended)

> Enterprise, no half-measures. Complete SaaS backend + thin WooCommerce connector + dashboard.
> Local file-based page cache only. No edge proxy. Per-store isolation.
> Surgical WooCommerce-native invalidation and intelligent warmup only.

---

## Amendments from v1.0

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Pricing mismatch: plan said $29/$69/$99, site shows $29/$79/$149 | **Use site prices**: Solo $29, Studio $79, Portfolio $149 |
| 2 | Annual billing missing from plan | **Add**: $290/$790/$1490 annual. Stripe annual price IDs per tier |
| 3 | Plugin branding: plan said `mamba-connector.php` | **Use `silo-connector.php`** to match public brand "Silo" |
| 4 | 14-day trial not explicit in Stripe flow | **Add**: `trial_period_days: 14`, no card required at signup |
| 5 | Event limits (100k/500k/2M) not enforced | **Add**: Monthly event counter per store, soft limit with dashboard warning, hard cutoff at 120% |
| 6 | Warmup URL limits (50/250/500 per event) not enforced | **Add**: Per-tier cap in config generation and warmup queue |
| 7 | Log retention (30/90/180 days) not in plan | **Add**: Cron job to prune Event/Metric rows past tier retention |
| 8 | Auth choice left open (Clerk or NextAuth) | **Pick Clerk** — fastest SaaS dashboard path, handles billing portal redirect |
| 9 | Job system left open (Vercel Cron or Inngest) | **Pick Vercel Cron + Postgres job table** — no extra service |
| 10 | No git repo | **Init git** at project start |

---

## 1. Product Definition

Users connect a WooCommerce store via a thin connector plugin. The SaaS scans the catalog once, generates a precise per-store cache profile and invalidation graph, pushes the config, and thereafter orchestrates all purge and warmup decisions. The connector serves cache files from disk and reports events. Correctness lives in the cloud. Each store is fully isolated.

### Pricing tiers (enforced in code)

| Tier | Stores | Monthly | Annual | Events/mo | Warmup URLs/event | Log retention |
|------|--------|---------|--------|-----------|-------------------|---------------|
| Solo | 1 | $29 | $290 | 100k | 50 | 30 days |
| Studio | 3 | $79 | $790 | 500k | 250 | 90 days |
| Portfolio | 5 | $149 | $1,490 | 2M | 500 | 180 days |

No unlimited. No agency. Downgrade blocks new connections and marks excess stores read-only until resolved.

---

## 2. Tech Stack

- **App**: Next.js 15 (App Router) on Vercel
- **Database**: Vercel Postgres (Neon) + Prisma
- **Auth**: Clerk (with per-store API keys for connectors)
- **Billing**: Stripe Checkout + Customer Portal + webhooks
- **Jobs**: Vercel Cron + Postgres job table
- **Realtime** (optional v2): Pusher/Ably for dashboard live feed
- **Connector**: Minimal PHP 8.1+ WordPress plugin (`silo-connector`)
- **Monitoring**: Sentry + structured logs

---

## 3. Database Schema (Prisma)

```prisma
model User {
  id                 String         @id @default(cuid())
  clerkId            String         @unique
  email              String         @unique
  stripeCustomerId   String?
  subscription       Subscription?
  stores             Store[]
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
}

model Subscription {
  id                 String   @id @default(cuid())
  userId             String   @unique
  stripeSubId        String   @unique
  stripePriceId      String
  status             String   // active | trialing | past_due | canceled
  tier               String   // "solo" | "studio" | "portfolio"
  billingInterval    String   // "month" | "year"
  currentPeriodEnd   DateTime
  trialEnd           DateTime?
  user               User     @relation(fields: [userId], references: [id])
}

model Store {
  id                 String         @id @default(cuid())
  userId             String
  name               String
  url                String
  apiKey             String         @unique
  apiKeyHash         String
  status             String         // pending | scanning | optimized | error | offline
  profile            Json           // full scan result
  config             Json           // generated config (versioned)
  configVersion      Int            @default(1)
  lastScanAt         DateTime?
  lastEventAt        DateTime?
  lastSeenAt         DateTime?
  hitRate            Float          @default(0)
  monthlyEvents      Int            @default(0)
  monthlyEventsReset DateTime?
  user               User           @relation(fields: [userId], references: [id])
  events             Event[]
  warmupJobs         WarmupJob[]
  metrics            Metric[]
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt
}

model Event {
  id                 String   @id @default(cuid())
  storeId            String
  type               String   // product_updated | stock_changed | order_created | sale_boundary | etc.
  payload            Json
  purgeUrls          Json?
  warmUrls           Json?
  processed          Boolean  @default(false)
  error              String?
  createdAt          DateTime @default(now())
  store              Store    @relation(fields: [storeId], references: [id])

  @@index([storeId, createdAt])
}

model WarmupJob {
  id                 String   @id @default(cuid())
  storeId            String
  status             String   // pending | running | completed | failed | partial
  urls               Json
  progress           Int      @default(0)
  total              Int
  error              String?
  createdAt          DateTime @default(now())
  completedAt        DateTime?
  store              Store    @relation(fields: [storeId], references: [id])

  @@index([storeId, status])
}

model Metric {
  id                 String   @id @default(cuid())
  storeId            String
  date               DateTime @db.Date
  hits               Int      @default(0)
  misses             Int      @default(0)
  purges             Int      @default(0)
  warms              Int      @default(0)
  eventsUsed         Int      @default(0)
  store              Store    @relation(fields: [storeId], references: [id])

  @@unique([storeId, date])
}
```

---

## 4. Config Schema (pushed to connector)

Stored in `Store.config` and sent on apply:

```json
{
  "version": 1,
  "tier": "studio",
  "limits": {
    "warmup_urls_per_event": 250,
    "max_monthly_events": 500000
  },
  "variants": {
    "device": true,
    "language": ["en", "fr"],
    "currency": true,
    "geo_tax": true,
    "attribute_filters": true,
    "pagination": true
  },
  "exclusions": [
    "/cart",
    "/checkout",
    "/my-account",
    "query:add-to-cart",
    "logged_in_with_cart"
  ],
  "ttl": {
    "product": 3600,
    "category": 1800,
    "shop": 1800,
    "store_api": 300
  },
  "priority_products": [123, 456, 789],
  "priority_urls": ["https://store.com/product/bestseller/"],
  "invalidation_rules": {
    "on_product_update": ["product_url", "categories", "tags", "shop_variants", "store_api_products"],
    "on_stock_change": ["product_url", "categories", "shop_variants"],
    "on_order": ["affected_products", "categories"]
  },
  "store_api": {
    "enabled": true,
    "endpoints": ["/wc/store/v1/products", "/wc/store/v1/cart"],
    "vary": ["currency", "language"]
  },
  "hooks_required": [
    "woocommerce_product_object_updated_props",
    "woocommerce_product_set_stock",
    "woocommerce_variation_set_stock",
    "woocommerce_order_status_changed",
    "woocommerce_update_product",
    "woocommerce_new_product_variation"
  ]
}
```

---

## 5. Connector Plugin Specification (`silo-connector`)

Minimal responsibilities only. PHP 8.1+.

### File structure

```
silo-connector/
  silo-connector.php          (main plugin file)
  includes/
    class-page-cache.php
    class-event-reporter.php
    class-config-applier.php
    class-warmup.php
  advanced-cache.php           (drop-in)
  readme.txt
```

### Core classes

- **PageCache**: Serves files from `wp-content/cache/silo/`. Key = hash(url + variant factors). Hard bypass for cart/checkout/account/logged-in-with-items. Stale-while-revalidate.
- **EventReporter**: Registers exact Woo hooks. On fire, POSTs signed payload to SaaS `/api/events`.
- **ConfigApplier**: Receives config via `/wp-json/silo/v1/apply`, writes it, registers hooks, sets drop-in.
- **Warmup**: Receives URL list and requests them concurrently (limited).

### Hooks to register

- `woocommerce_product_object_updated_props`
- `woocommerce_product_set_stock` / `woocommerce_variation_set_stock`
- `woocommerce_order_status_changed` / HPOS equivalents
- `woocommerce_update_product` / `woocommerce_new_product_variation`
- Sale boundary (scheduled or on price meta change)
- Option updates for currency/language if relevant

### Security

- Every request to SaaS includes HMAC signature using store API key
- Connector verifies incoming apply requests the same way
- Nonce verification on admin pages

### Exposed endpoints

- `POST /wp-json/silo/v1/connect` — initial handshake + snapshot
- `POST /wp-json/silo/v1/apply` — receive config + purge list + warm list
- `GET /wp-json/silo/v1/stats` — hit/miss counters
- `POST /wp-json/silo/v1/purge` — manual or targeted
- `GET /wp-json/silo/v1/health` — heartbeat for SaaS polling

---

## 6. Core Logic

### A. Scan & Profile Generation (on connect)

Connector sends snapshot:

```json
{
  "url": "...",
  "product_count": 1842,
  "product_types": {"simple": 1200, "variable": 642},
  "variation_complexity": "high",
  "stock_management": true,
  "hpos": true,
  "multilingual": ["en", "fr"],
  "multi_currency": true,
  "bestsellers": [101, 202, 303],
  "existing_cache": "wp-rocket"
}
```

SaaS generates config (variants, priority list from bestsellers, invalidation rules, TTLs) and pushes it. Status -> `optimized`.

### B. Invalidation Algorithm (SaaS-side)

On event receipt:

1. Check monthly event limit. If exceeded, log + reject with 429.
2. Load store profile + config.
3. Resolve affected entities:
   - Product update / stock change -> product URL + all categories/tags containing it + shop order-by variants + relevant Store API.
   - Variation change -> specific variation + parent.
   - Order -> products in order + their categories.
   - Sale boundary -> affected products.
4. Generate exact URL list (including variants).
5. Cap warm URLs at tier limit.
6. Return `{ purge: [...], warm: [...] }` to connector.
7. Log event with purge/warm sets.
8. Queue warmup job if warm list present.
9. Increment `monthlyEvents` counter.

### C. Warmup System

- Priority list ordered by recent sales velocity + featured.
- After every purge, auto-queue the purged URLs (capped at tier limit).
- Daily low-traffic full priority pass via Vercel Cron.
- Concurrency limit calculated from catalog size (5-20 parallel).
- Progress written back; failures retried once.

---

## 7. Backend API Endpoints

### Connector-facing (API key + HMAC)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/stores/connect` | Receive snapshot, generate + return config |
| POST | `/api/events` | Receive event, compute purge/warm, return actions |
| POST | `/api/stats` | Ingest hits/misses |
| GET | `/api/stores/[id]/config` | Poll for config updates |

### Authenticated dashboard (Clerk)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/stores` | List user's stores (tier-checked) |
| POST | `/api/stores` | Create store (check tier limit) |
| GET | `/api/stores/[id]` | Status, recent events, metrics |
| POST | `/api/stores/[id]/rescan` | Trigger rescan |
| POST | `/api/stores/[id]/purge` | Full or targeted |
| GET | `/api/billing/portal` | Stripe Customer Portal redirect |
| POST | `/api/billing/checkout` | Create Stripe Checkout session |

### Webhooks

| Path | Purpose |
|------|---------|
| POST `/api/webhooks/stripe` | Subscription events -> update tier, enforce limits |
| POST `/api/webhooks/clerk` | User creation/deletion sync |

---

## 8. Dashboard Pages & Features

| Page | Features |
|------|----------|
| `/dashboard` | Store list with status, hit rate, last event, monthly events used |
| `/dashboard/stores/[id]` | Hit-rate chart, recent invalidations feed, warmup progress, rescan/purge buttons, event usage meter |
| `/dashboard/connect` | Connection wizard: generate key -> download plugin -> confirm |
| `/dashboard/billing` | Tier cards, current plan, usage, portal link |
| `/dashboard/settings` | Account, API keys, notifications |

### Health indicators
- Connector last seen (lastSeenAt)
- Cache writable status
- Event usage vs limit
- Error states with actionable messages

---

## 9. Security & Isolation

- Per-store API key (hashed in DB, plain shown once at creation)
- HMAC-SHA256 on all connector <-> SaaS traffic
- Strict `userId` checks on every dashboard route (Clerk middleware)
- Rate limiting on connector endpoints (per-store, per-IP)
- No cross-store data leakage (all queries scoped by userId + storeId)
- Config versioning for safe updates
- Webhook signature verification (Stripe, Clerk)

---

## 10. Metrics & Observability

- Connector reports hits/misses periodically (every 5 min or 1000 requests)
- SaaS aggregates daily into Metric table
- Dashboard shows 7/30-day hit rate chart
- Event usage: monthly counter with tier limit bar
- Health: lastSeenAt, lastEventAt, error states
- Sentry on both SaaS and connector
- Structured JSON logs for all API endpoints

---

## 11. Error Handling & Edge Cases

- Scan incomplete -> retry + status `error` + dashboard message
- Connector offline -> mark `offline`, alert in dashboard, fail closed (no stale cache served)
- Purge partial failure -> log and retry critical URLs
- HPOS vs legacy orders handled in event payload normalization
- Multi-currency / WPML detected and variants enabled only if present
- Existing cache plugins detected and warned (with specific instructions per plugin)
- Downgrade: excess stores set to read-only, existing cache continues to serve but no new events processed
- Stripe past_due: stores remain but new connections blocked
- Event limit exceeded: soft warning at 80%, hard cutoff at 100% (events rejected with 429)
- Monthly event counter resets on billing period start (via Stripe webhook)

---

## 12. Onboarding Flow

1. User signs up via Clerk (no card required).
2. 14-day trial starts automatically.
3. User creates store -> receives API key + plugin download link.
4. Installs plugin, pastes key in WP admin.
5. Connector sends snapshot to SaaS `/api/stores/connect`.
6. SaaS generates config and pushes it back.
7. First warmup of priority products starts.
8. Dashboard shows "Optimized" + live hit rate once traffic arrives.

---

## 13. Implementation Order

| Phase | What | Status |
|-------|------|--------|
| 1 | Prisma schema + migrations + Clerk auth + user sync | Not started |
| 2 | Stripe integration: products, prices, checkout, portal, webhooks | Not started |
| 3 | Store CRUD + tier enforcement + API key generation | Not started |
| 4 | Connector skeleton: cache serve + event POST + apply endpoint | Not started |
| 5 | Scan endpoint + config generation algorithm | Not started |
| 6 | Event endpoint + full invalidation algorithm | Not started |
| 7 | Warmup job system + Vercel Cron | Not started |
| 8 | Dashboard: store list + single store view + charts | Not started |
| 9 | Metrics ingestion + daily aggregation | Not started |
| 10 | HMAC security, rate limiting, health checks | Not started |
| 11 | Onboarding wizard (connect flow rewrite) | Not started |
| 12 | Edge-case hardening: HPOS, multi-currency, sale boundaries, log retention | Not started |
| 13 | Testing, QA, polish | Not started |

---

## Current Project State

_Scorecard updated 2026-11-24. Domain: heysilo.co (Vercel). Connector v2.2.0._

### Done

| Area | State |
|---|---|
| Marketing site | Complete: home, features, pricing, how it works, guide, docs, FAQ, legal, sitemap, OG |
| Accounts | Sign up, sign in (brute-force brake), session revocation (password change, suspend, sign out everywhere), profile and email change (password required), password change, account deletion (cancels Stripe first), password reset by email (needs Resend env vars) |
| Access model | `lib/entitlements.ts`: 14-day no-card trial, paid, past_due grace, complimentary (admin), expired, canceled, suspended. Store limit enforced oldest-first after downgrades. Admin accounts are complimentary Portfolio |
| Billing | Stripe Checkout (trial days carry over, one subscription per account), billing portal, webhook mirrors subscriptions (interval, period end, cancel-at-period-end, amount) and invoices; billing page with status, usage meters, plans, invoice history |
| Logs | Customer Activity page (account audit log + links to each store's invalidation log); store invalidation, warmup and catalog logs |
| Admin console (`/admin`) | Overview (MRR, ARR, 30-day revenue, pipeline, trials, stores online, events, cron health, connector versions), users (search, filters, detail, extend/end trial, comp plan, suspend, role, sign out, delete), stores (all, filters, detail, purge, rescan), revenue (12-month chart, plans, invoices), events, audit log, system (env presence checks, cron runs, table sizes) |
| Connector | Page cache (drop-in + late serve), Store API cache, fragments, surgical invalidation, sale boundaries, warmup, scan, real-time sync, exports, WPCS clean, PHP 8.1–8.4 |
| Works alongside | Auto/coexist/silo modes. Purges WP Rocket, LiteSpeed, W3TC, WP Super Cache, WP Fastest Cache, FlyingPress, SiteGround, Hummingbird, Cache Enabler, WP-Optimize; host caches (Nginx Helper, WP Engine, Kinsta, Pantheon, SpinupWP); Cloudflare by API. Builders: Elementor, Beaver Builder, Divi, Bricks, Oxygen, Breakdance, theme layout CPTs |
| Plan enforcement | Every connector route gated; inactive plans return 403 PLAN_INACTIVE so the connector fails closed (no cached pages that nothing can invalidate) |
| Scheduled jobs | warmup, daily warmup, monthly event reset (UTC), nightly retention cleanup; every run recorded for the admin console |

### Outstanding

| Item | Needs |
|---|---|
| Schema push for this release | Owner approval, then `npx prisma db push` (additive: User role/trial/suspension/session fields, Subscription cancel/amount/currency, Invoice, PasswordResetToken, AuditLog, CronRun) |
| Vercel env | `NEXT_PUBLIC_SITE_URL=https://heysilo.co`, `SILO_PUBLIC_URL=https://heysilo.co`, `ADMIN_EMAILS`, `RESEND_API_KEY` + `EMAIL_FROM` (optional, enables password reset) |
| Stripe | Webhook endpoint `https://heysilo.co/api/webhooks/stripe` with events: checkout.session.completed, customer.subscription.*, invoice.* ; customer portal enabled with plan switching |
| Mailboxes | hello@, support@, billing@, privacy@, legal@ heysilo.co must exist (site copy points there) |
| Email verification on sign-up / email change | Needs the email provider above |
| Status page | Still static copy; wire to real uptime data or remove |
| Pricing copy | Says currency/geo cache keys are Portfolio-only; the connector applies them on every plan (required for correctness). Decide: update copy |
| End-to-end test on a real WooCommerce site | Install v2.2.0 next to WP Rocket and verify coexist purges; verify an expired trial pauses caching and a new plan resumes it |
