import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, tierFromPrice } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

type Loose = Record<string, unknown>;

function customerIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : null;
}

function toDate(seconds: unknown): Date | null {
  return typeof seconds === "number" && seconds > 0 ? new Date(seconds * 1000) : null;
}

/** The Silo account for a Stripe customer: stored customer id first, then checkout metadata. */
async function findUser(customerId: string | null, metadataUserId?: unknown) {
  if (customerId) {
    const byCustomer = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true, stripeCustomerId: true } });
    if (byCustomer) return byCustomer;
  }
  if (typeof metadataUserId === "string" && metadataUserId) {
    const byId = await prisma.user.findUnique({ where: { id: metadataUserId }, select: { id: true, stripeCustomerId: true } });
    if (byId && customerId && !byId.stripeCustomerId) {
      await prisma.user.update({ where: { id: byId.id }, data: { stripeCustomerId: customerId } });
    }
    return byId;
  }
  return null;
}

/**
 * Mirror one Stripe subscription onto the account. Newer API versions keep the billing
 * period on the subscription item, older ones on the subscription; both are read.
 */
async function syncSubscription(sub: Stripe.Subscription, eventType: string) {
  const raw = sub as unknown as Loose;
  const item = sub.items?.data?.[0] as unknown as Loose | undefined;
  const price = (item?.price ?? {}) as Loose;
  // The Stripe account is shared with other products: only Silo prices are synced.
  const mapped = tierFromPrice(price as Parameters<typeof tierFromPrice>[0]);
  if (!mapped) return;

  const customerId = customerIdOf(sub.customer);
  const user = await findUser(customerId, sub.metadata?.userId);
  if (!user) return;

  const priceId = typeof price.id === "string" ? price.id : "";
  const interval = mapped.interval;
  const tier = mapped.tier;
  const periodEnd = toDate(item?.current_period_end) ?? toDate(raw.current_period_end) ?? new Date();
  const amount = typeof price.unit_amount === "number" ? price.unit_amount : null;
  const currency = typeof price.currency === "string" ? price.currency : null;
  const cancelAtPeriodEnd = Boolean(raw.cancel_at_period_end) || Boolean(raw.cancel_at);

  const existing = await prisma.subscription.findUnique({ where: { userId: user.id }, select: { stripeSubId: true, status: true } });

  // An old subscription ending must not overwrite a newer live one.
  if (existing && existing.stripeSubId !== sub.id && ["active", "trialing", "past_due"].includes(existing.status) && !["active", "trialing", "past_due"].includes(sub.status)) {
    return;
  }

  const data = {
    stripeSubId: sub.id,
    stripePriceId: priceId,
    status: sub.status,
    tier,
    billingInterval: interval,
    currentPeriodEnd: periodEnd,
    trialEnd: toDate(sub.trial_end),
    cancelAtPeriodEnd,
    amount,
    currency,
  };
  await prisma.subscription.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });

  const changed = !existing || existing.status !== sub.status || existing.stripeSubId !== sub.id;
  if (eventType === "customer.subscription.deleted") {
    await audit("billing.canceled", { userId: user.id, target: sub.id, detail: { tier } });
  } else if (changed || eventType === "customer.subscription.created") {
    await audit("billing.subscription", { userId: user.id, target: sub.id, detail: { tier, interval, status: sub.status, cancelAtPeriodEnd } });
  }
}

async function syncInvoice(invoice: Stripe.Invoice) {
  const raw = invoice as unknown as Loose;
  if (!invoice.id) return null;
  const user = await findUser(customerIdOf(invoice.customer), (invoice.metadata as Loose | null)?.userId);
  if (!user) return null;

  const data = {
    number: invoice.number ?? null,
    status: invoice.status ?? "open",
    amountDue: invoice.amount_due ?? 0,
    amountPaid: invoice.amount_paid ?? 0,
    currency: invoice.currency ?? "usd",
    hostedUrl: invoice.hosted_invoice_url ?? null,
    pdfUrl: invoice.invoice_pdf ?? null,
    periodStart: toDate(raw.period_start),
    periodEnd: toDate(raw.period_end),
  };
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: { userId: user.id, stripeInvoiceId: invoice.id, createdAt: toDate(invoice.created) ?? new Date(), ...data },
    update: data,
  });
  return user;
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Webhook error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = customerIdOf(session.customer);
        await findUser(customerId, session.client_reference_id ?? session.metadata?.userId);
        const subId = customerIdOf(session.subscription);
        if (subId) {
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(sub, event.type);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
      case "customer.subscription.paused":
      case "customer.subscription.resumed":
        await syncSubscription(event.data.object as Stripe.Subscription, event.type);
        break;

      case "invoice.created":
      case "invoice.finalized":
      case "invoice.updated":
      case "invoice.voided":
      case "invoice.marked_uncollectible":
        await syncInvoice(event.data.object as Stripe.Invoice);
        break;

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const user = await syncInvoice(invoice);
        if (user && (invoice.amount_paid ?? 0) > 0) {
          await audit("billing.invoice_paid", { userId: user.id, target: invoice.number ?? invoice.id ?? null, detail: { amount: invoice.amount_paid, currency: invoice.currency } });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const user = await syncInvoice(invoice);
        if (user) {
          // Stripe moves the subscription to past_due itself and sends subscription.updated.
          await audit("billing.payment_failed", { userId: user.id, target: invoice.number ?? invoice.id ?? null, detail: { amount: invoice.amount_due, currency: invoice.currency } });
        }
        break;
      }
    }
  } catch (error) {
    // 500 makes Stripe retry later.
    console.error("[stripe] webhook handling failed", event.type, error);
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
