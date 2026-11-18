import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { priceIdToTier } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const firstItem = sub.items.data[0];
      const priceId = firstItem?.price.id;
      const tierInfo = priceIdToTier(priceId ?? "");
      const periodEndRaw = (sub as unknown as Record<string, unknown>).current_period_end as number | undefined;
      const periodEnd = periodEndRaw
        ? new Date(periodEndRaw * 1000)
        : new Date();

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      await prisma.subscription.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          stripeSubId: sub.id,
          stripePriceId: priceId ?? "",
          status: sub.status,
          tier: tierInfo?.tier ?? "solo",
          billingInterval: tierInfo?.interval ?? "monthly",
          currentPeriodEnd: periodEnd,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        },
        update: {
          stripeSubId: sub.id,
          stripePriceId: priceId ?? "",
          status: sub.status,
          tier: tierInfo?.tier ?? "solo",
          billingInterval: tierInfo?.interval ?? "monthly",
          currentPeriodEnd: periodEnd,
          trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      await prisma.subscription.updateMany({
        where: { userId: user.id },
        data: { status: "canceled" },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      await prisma.subscription.updateMany({
        where: { userId: user.id },
        data: { status: "past_due" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
