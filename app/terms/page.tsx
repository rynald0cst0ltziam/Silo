import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms that govern use of Silo, the WooCommerce cache and invalidation service.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      current="/terms"
      title="Terms of service"
      intro="These terms govern access to Silo's website, dashboard and connector. By creating an account or connecting a store, you agree to them."
    >
      <h2>1. The service</h2>
      <p>
        Silo provides a page cache and catalog-aware invalidation service for WooCommerce
        stores, together with a WordPress connector, dashboard and related documentation. Silo
        is an independent product and is not affiliated with or endorsed by WooCommerce or
        Automattic.
      </p>

      <h2>2. Accounts and store connections</h2>
      <ul>
        <li>You must provide accurate account information and keep it current.</li>
        <li>You are responsible for activity under your account and for safeguarding store keys.</li>
        <li>
          Store keys are scoped to a single store. You may not share a key across stores or
          attempt to use one tenant&apos;s key against another tenant.
        </li>
        <li>
          You confirm you are authorised to install the connector and change caching settings
          on each store you connect.
        </li>
      </ul>

      <h2>3. Trials and fees</h2>
      <p>
        Trials last 14 days and do not require a card unless stated otherwise at checkout. Paid
        plans are billed per connected store, monthly in advance or annually in advance. Fees
        exclude taxes, which are added where required. Subscriptions renew automatically until
        cancelled. We may change prices with at least 30 days&apos; notice before your next
        renewal.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You may not use Silo to:</p>
      <ul>
        <li>Violate any law or the rights of another person.</li>
        <li>Bypass authentication, payment or security controls on a store.</li>
        <li>Send unlawful, deceptive or abusive content through support or the connector.</li>
        <li>Resell, sublicense or white-label the service without a written agreement.</li>
        <li>Load-test the platform, probe other tenants or attempt to access data you do not own.</li>
        <li>Reverse engineer the service except where that restriction is prohibited by law.</li>
      </ul>

      <h2>5. Your data and licence</h2>
      <p>
        You retain ownership of your store data. You grant Silo a limited licence to process
        store metadata and cache events solely to provide the service. We may use aggregated,
        de-identified operational data to improve reliability and performance. Our handling of
        personal data is described in the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>6. Cache behaviour and correctness</h2>
      <p>
        Silo invalidates cached responses based on events emitted by WooCommerce and the
        connector. Changes made directly in the database, or in ways that bypass WooCommerce
        hooks, may not emit an event and therefore cannot trigger invalidation. You are
        responsible for disabling other page caches on connected stores and for notifying us of
        custom code that changes catalog state outside normal WooCommerce flows. Performance
        figures on this site illustrate the cache model and are not a guarantee.
      </p>

      <h2>7. Availability and support</h2>
      <p>
        We target 99.9% monthly availability for the invalidation API and dashboard, excluding
        scheduled maintenance announced in advance. Your store keeps serving and purging its own
        cache if the API is unreachable; if the connector is deactivated or its key is rejected,
        cached pages stop being served and traffic goes to your origin. Support is provided by email, with
        response targets that vary by plan. Current platform status is published at{" "}
        <a href="/status">/status</a>.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        Silo and its licensors own the service, software, documentation, design and trademarks.
        These terms do not transfer any ownership. If you send feedback, you grant us a
        perpetual, royalty-free licence to use it without obligation.
      </p>

      <h2>9. Disclaimers</h2>
      <p>
        Except as expressly stated, the service is provided &ldquo;as is&rdquo; and &ldquo;as
        available&rdquo;. To the maximum extent permitted by law, we disclaim implied warranties
        of merchantability, fitness for a particular purpose and non-infringement. We do not
        warrant that the service will be uninterrupted, error-free or that every cache entry
        will be invalidated in every custom integration.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, neither party is liable for indirect, incidental,
        special, consequential or punitive damages, or for lost profits, revenue, goodwill or
        data. Silo&apos;s aggregate liability under these terms is limited to the fees you paid
        us in the 12 months before the claim. Nothing in these terms limits liability that
        cannot be limited by law.
      </p>

      <h2>11. Termination</h2>
      <p>
        You may cancel at any time from the dashboard. We may suspend or terminate access for
        material breach, non-payment, abuse or a security risk. On termination, we make account
        data available for export for 30 days where reasonably possible, then delete it subject
        to legal retention requirements.
      </p>

      <h2>12. Governing law and changes</h2>
      <p>
        These terms are governed by the laws of the State of Delaware, USA, excluding its
        conflict-of-laws rules. The state and federal courts located in Wilmington, Delaware
        have exclusive jurisdiction, except where consumer law requires otherwise. We may update
        these terms and will post material changes with a new effective date. Continued use
        after the effective date constitutes acceptance.
      </p>

      <h2>13. Contact</h2>
      <p>
        Silo Systems, Inc., 2261 Market Street, San Francisco, CA 94114, USA.{" "}
        <a href="mailto:legal@getsilo.com">legal@getsilo.com</a>.
      </p>
    </LegalPage>
  );
}
