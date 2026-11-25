import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Refund policy",
  description: "Silo trial, cancellation and refund terms for monthly and annual plans.",
  alternates: { canonical: "/refund" },
};

export default function RefundPage() {
  return (
    <LegalPage
      current="/refund"
      title="Refund policy"
      intro="Try Silo on a real store before you pay. If a paid plan is not right, the terms below explain what we refund and when."
    >
      <h2>1. The trial comes first</h2>
      <p>
        Every account starts with a 3-day trial and no card is required. The trial begins when
        the account is created and covers one store. You can connect a real store, run a stock
        change and inspect the invalidation log before deciding. If you choose a plan with more
        than two days of the trial left, the first charge happens when the trial ends; otherwise
        billing starts the day you subscribe. If the trial ends without a plan, caching pauses on your store until a plan
        starts; your store keeps working with live pages.
      </p>

      <h2>2. Monthly plans</h2>
      <p>
        Monthly subscriptions can be cancelled at any time from Billing in the dashboard. Cancellation
        stops the next renewal; the current month is not prorated and is generally not refunded
        once the billing period has started. If a duplicate charge or a billing error occurs, we
        will correct it.
      </p>

      <h2>3. Annual plans</h2>
      <p>
        Annual plans are refundable in full within 30 days of the initial purchase. After 30
        days, the remaining term is not refundable on demand, but you can cancel to prevent
        renewal. If Silo materially fails to provide the service for a sustained period, contact
        us — we will issue a service credit or a pro-rata refund for the affected period.
      </p>

      <h2>4. Plan changes</h2>
      <p>
        Plan and billing-interval changes are made in the Stripe billing portal (Billing → Change
        plan) and take effect immediately; Stripe prorates the difference as a credit or charge on
        your next invoice. If the new plan covers fewer stores, your oldest stores stay active up
        to the new limit and the others pause until you remove a store or upgrade.
      </p>

      <h2>5. Exceptions</h2>
      <ul>
        <li>Refunds are not available for accounts suspended for abuse or terms violations.</li>
        <li>Chargebacks filed without contacting us first may result in account suspension.</li>
        <li>Third-party costs, such as your CDN or host, are outside our control and are not refundable by Silo.</li>
        <li>
          Nothing in this policy limits statutory rights you may have under consumer law in your
          jurisdiction.
        </li>
      </ul>

      <h2>6. How to request a refund</h2>
      <p>
        Email <a href="mailto:rynaldostoltz85@gmail.com">rynaldostoltz85@gmail.com</a> from the account email
        with the store URL and the invoice number. We aim to respond within two business days
        and to process approved refunds to the original payment method within 5–10 business
        days, depending on your bank.
      </p>

      <h2>7. Cancellation</h2>
      <p>
        Cancel from <strong>Dashboard → Billing → Change plan, card or cancel</strong>, or email
        billing and we will do it for you. Access continues to the end of the paid period, then
        caching pauses on connected stores. Deleting your account under Dashboard → Account
        cancels the subscription immediately. Invalidation logs
        remain available for export for 30 days after cancellation, within your plan&apos;s
        retention window.
      </p>

      <h2>8. Contact</h2>
      <p>
        Billing, product and connector questions:{" "}
        <a href="mailto:rynaldostoltz85@gmail.com">rynaldostoltz85@gmail.com</a>.
      </p>
    </LegalPage>
  );
}
