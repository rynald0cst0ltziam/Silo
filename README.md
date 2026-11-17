# Silo — cache for WooCommerce

Marketing site and demo dashboard for Silo, a WooCommerce-only cache with inventory-aware
surgical invalidation. Built with Next.js App Router, React 19, Tailwind CSS v4 and a
Neon Postgres lead table. Designed for Vercel.

## Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. No environment variables are required for local development.
When `DATABASE_URL` is not set, connect-store requests are written to
`.data/connect-requests.jsonl` locally (including `npm start`); on Vercel, the endpoint
requires the database and returns a clear 503 instead.

Production build check:

```bash
npm run build
npm start
```

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Landing page: hero, failure modes, how it works, graph, features, dashboard, comparison, testimonials, pricing, CTA |
| `/pricing` | Three plans (1 / 3 / 5 stores), inclusions, FAQ |
| `/how-it-works` | Scan, invalidation graph, session boundary, dashboard |
| `/faq` | Grouped answers on correctness, invalidation, setup and billing |
| `/docs` | Quickstart, requirements, events, troubleshooting, limits |
| `/login` | Split-screen sign-in UI (preview: opens the demo workspace) |
| `/dashboard` | Full sample workspace |
| `/status` | Service status and incident history |
| `/privacy`, `/terms`, `/refund` | Legal pages |

Metadata, Open Graph image (`app/opengraph-image.tsx`), `sitemap.xml`, `robots.txt` and
SoftwareApplication JSON-LD are included. Analytics is opt-in and cookie-less.

## Database: Vercel + Neon

Vercel Postgres is retired; new projects connect Postgres through the Vercel Marketplace. Neon
is the Vercel-managed default and injects `DATABASE_URL` automatically.

1. Push the repository to GitHub and import it into Vercel.
2. In the Vercel project, open **Storage / Marketplace** and install **Neon**.
3. Select the project, region and plan. Vercel injects `DATABASE_URL` (pooled).
4. Deploy. The `store_requests` table is created on the first connect request, or run
   [`db/schema.sql`](db/schema.sql) in the Neon SQL editor.
5. For local development with the real database, copy `.env.example` to `.env.local` and paste
   the pooled connection string.

The endpoint is `app/api/connect/route.ts`; storage is `lib/db.ts`. If the database is not
configured in production, the form returns a clear 503 instead of silently losing the lead.

## Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical origin for metadata, sitemap and OG |
| `DATABASE_URL` | Production form | Neon pooled connection string (auto-injected by Vercel) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Optional | Enables Plausible analytics; blank disables it |

`NEXT_PUBLIC_POSTHOG_KEY` is listed in `.env.example` as an alternative but the shipped
`components/analytics.tsx` uses Plausible. Replace the component if you prefer PostHog.

## Editing content

- Pricing, FAQs, comparison rows and testimonials live in `lib/content.ts`.
- Design tokens and reusable classes live in `app/globals.css`.
- Shared sections are in `components/`; pages compose them under `app/`.
- Type is self-hosted Space Grotesk throughout; monospace is used only inside code snippets.

## Before launch

- **Auth is not connected.** `/login` intentionally opens the sample dashboard and states that
  it is a preview. Replace `components/login-form.tsx` with your auth provider before launch.
- **Stripe checkout is not wired.** Pricing CTAs open the connect-store request flow. Add a
  checkout route and price IDs when the backend is ready.
- **Placeholders:** testimonials, dashboard metrics, uptime figures, social links and the
  `getsilo.com` domain are placeholders. Replace them with approved customer references, real
  status data and your domain.
- **Legal copy** is a practical starting point, not legal advice. Have counsel review it.
- Set up `hello@`, `support@`, `billing@`, `privacy@` and `legal@` mailboxes for the addresses
  referenced in the site.
- Replace the sample emails with your real domain before publishing.

## Checks

```bash
npm run build
```

The build type-checks the whole app and generates the static pages, sitemap, robots and OG
image.
