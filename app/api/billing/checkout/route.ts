import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { TIERS, type TierSlug } from "@/lib/tiers";
import { getAccess } from "@/lib/entitlements";
import { audit } from "@/lib/audit";
import { siteUrl } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await authSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { subscription: true } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let body: { tier: string; interval: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { tier, interval } = body;
  if (!TIERS[tier as TierSlug]) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const priceKey = `${tier}_${interval === "month" ? "monthly" : "annual"}` as keyof typeof STRIPE_PRICES;
  const priceId = STRIPE_PRICES[priceKey];
  if (!priceId) {
    return NextResponse.json({ error: "Price not configured" }, { status: 500 });
  }

  const access = getAccess(user);
  if (access.state === "suspended") {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }
  // One subscription per account: plan changes go through the billing portal (prorated by Stripe).
  if (user.subscription && ["active", "trialing", "past_due", "incomplete"].includes(user.subscription.status)) {
    return NextResponse.json({ error: "You already have a subscription. Change plans from Billing → Manage subscription.", portal: true }, { status: 409 });
  }

  // Time left on the no-card trial carries over, so choosing a plan early never costs trial days.
  // Stripe requires a trial to end at least 48 hours out; accounts that have paid before get none.
  const hadPaid = !!user.subscription;
  const trialDays = !hadPaid && access.state === "trial" && access.trialDaysLeft >= 2 ? access.trialDaysLeft : 0;
  const base = siteUrl().replace(/\/+$/, "");

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, tier },
    subscription_data: {
      ...(trialDays ? { trial_period_days: trialDays } : {}),
      metadata: { userId: user.id, tier },
    },
    success_url: `${base}/dashboard/billing?checkout=success`,
    cancel_url: `${base}/dashboard/billing?checkout=canceled`,
    allow_promotion_codes: true,
  });

  await audit("billing.checkout", { userId: user.id, detail: { tier, interval, trialDays }, req });

  return NextResponse.json({ url: checkoutSession.url });
}
