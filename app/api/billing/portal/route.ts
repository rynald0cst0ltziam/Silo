import { NextResponse } from "next/server";
import { authSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, siloPortalConfiguration } from "@/lib/stripe";
import { siteUrl } from "@/lib/utils";

export async function GET() {
  const session = await authSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/sign-in", siteUrl()));
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.stripeCustomerId) {
    return NextResponse.redirect(new URL("/dashboard/billing", siteUrl()));
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    configuration: await siloPortalConfiguration(),
    return_url: `${siteUrl().replace(/\/+$/, "")}/dashboard/billing`,
  });

  return NextResponse.redirect(portalSession.url);
}
