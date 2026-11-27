import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Silo collects, uses and protects data across the marketing site, dashboard and connector.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage
      current="/privacy"
      title="Privacy policy"
      intro="Silo is infrastructure for WooCommerce stores. That means we handle store metadata and cache events — not your customers' carts, addresses or payment details."
    >
      <h2>1. Scope</h2>
      <p>
        This policy covers the Silo marketing site, the Silo dashboard and the Silo connector
        plugin. It explains what we collect, why, how long we keep it and the choices you have.
        Silo for WooCommerce is the controller of account data; your store remains the controller
        of its own customer data.
      </p>

      <h2>2. What we collect</h2>
      <h3>Account and billing data</h3>
      <ul>
        <li>Name, work email, company name and the stores you connect.</li>
        <li>
          Billing details are collected and processed by Stripe. We receive a customer ID,
          subscription status and the last four digits of a card — never the full payment method.
        </li>
        <li>
          An account activity log: sign-ins and failed sign-in attempts, password and profile
          changes, billing changes and store actions, each with a timestamp and IP address. You can
          see it under Dashboard → Activity. It exists to protect your account.
        </li>
      </ul>

      <h3>Store and connector metadata</h3>
      <ul>
        <li>
          Store URL, WordPress and WooCommerce versions, connector version, PHP version and
          heartbeat timestamps.
        </li>
        <li>
          Catalog shape: product and variation counts, category and attribute structure,
          permalink patterns and Store API route maps.
        </li>
        <li>
          Invalidation events: event type, product or variation identifiers, the cache scope
          touched, duration and warmup state. Event payloads are designed not to include
          end-customer data.
        </li>
      </ul>

      <h3>Usage and support data</h3>
      <ul>
        <li>Pages viewed in the dashboard, coarse region, browser type and referral source.</li>
        <li>Support correspondence and any diagnostics files you share with us.</li>
      </ul>

      <h2>3. What we do not collect</h2>
      <p>
        Silo does not receive your customers&apos; names, addresses, email addresses, order
        contents, cart contents or payment details. Cart, checkout and account requests are
        forwarded by the connector and are never stored in the shared cache. If a support request
        includes customer data, we ask you to redact it before sending.
      </p>

      <h2>4. Cookies and analytics</h2>
      <p>
        The dashboard uses an essential session cookie to keep you signed in. The marketing site
        uses no advertising cookies and no analytics cookies. To understand how the site is used,
        we count page views ourselves. Each view stores the page path, the referring website's
        domain (if any), the visitor's country, and a visitor code that is a one-way hash of the
        IP address and browser, combined with a secret and the date, so it can't identify you and
        can't be linked from one day to the next. We don't store IP addresses or full browser
        details. Browsers sending Do Not Track or Global Privacy Control are not counted, and
        visits from automated tools are ignored. We do not sell personal data or use it for
        cross-site advertising.
      </p>

      <h2>5. Why we use data</h2>
      <ul>
        <li>To provide the service: authenticate you, connect stores, run invalidations and warmup.</li>
        <li>To operate billing, trials, refunds and support.</li>
        <li>To secure the service, detect abuse and debug connector or cache failures.</li>
        <li>To improve the product using aggregated, de-identified usage patterns.</li>
        <li>To meet legal, tax and accounting obligations.</li>
      </ul>
      <p>
        Under GDPR, our legal bases are performance of a contract, legitimate interests in
        operating and securing the service, consent where required, and compliance with legal
        obligations.
      </p>

      <h2>6. Processors and sharing</h2>
      <p>
        We share data with service providers that help us run Silo, under contracts that limit
        their use of it: Vercel (hosting), Neon (Postgres database), Stripe (billing), Resend
        (transactional email such as password resets), and Plausible if analytics is enabled. We may also
        disclose data if required by law or to protect the rights and safety of Silo, our
        customers or others. We do not sell personal data.
      </p>

      <h2>7. Retention</h2>
      <ul>
        <li>
          Account data is kept while your account is active. Deleting your account (Dashboard →
          Account) removes it immediately, together with its stores, invalidation logs and metrics,
          and cancels any subscription.
        </li>
        <li>
          The account activity log is kept for 400 days, including after deletion, as a security
          record. Password reset links expire after one hour.
        </li>
        <li>Invalidation logs are retained according to your plan (30, 90 or 180 days).</li>
        <li>Billing records are kept for seven years where tax law requires it.</li>
        <li>Trial and waitlist requests are kept for 24 months unless you ask us to delete them.</li>
      </ul>

      <h2>8. Security</h2>
      <p>
        Store keys are scoped to a single store and can be rotated from the dashboard. Data is
        encrypted in transit. Access to production systems is limited, logged and reviewed.
        Connector payloads are signed and minimised. No system is perfectly secure, but we
        design for a narrow blast radius: a compromised store key should affect one store, not
        your whole account or another tenant.
      </p>

      <h2>9. International transfers</h2>
      <p>
        Silo is operated from the United States and uses providers in the United States and the
        European Union. Where personal data moves from the EEA or UK, we rely on Standard
        Contractual Clauses and equivalent safeguards.
      </p>

      <h2>10. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to access, correct, export or delete
        personal data, object to processing, restrict it, or withdraw consent. Email{" "}
        <a href="mailto:rynaldostoltz85@gmail.com">rynaldostoltz85@gmail.com</a>. We respond within 30 days.
        You can also complain to your local data protection authority.
      </p>

      <h2>11. Children</h2>
      <p>
        Silo is a business tool and is not directed at children under 16. We do not knowingly
        collect data from children.
      </p>

      <h2>12. Changes and contact</h2>
      <p>
        We will post material changes to this policy and, where appropriate, email account
        owners. Questions: <a href="mailto:rynaldostoltz85@gmail.com">rynaldostoltz85@gmail.com</a> or Silo
        Systems, Inc., 2261 Market Street, San Francisco, CA 94114, USA.
      </p>
    </LegalPage>
  );
}
