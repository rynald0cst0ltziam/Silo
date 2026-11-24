import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { audit } from "@/lib/audit";

/** Update the profile: name, and email (current password required to change the email). */
export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { name?: unknown; email?: unknown; password?: unknown } | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const data: { name?: string | null; email?: string } = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 120) || null;

  if (typeof body.email === "string" && body.email.trim().toLowerCase() !== user.email) {
    const email = body.email.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (typeof body.password !== "string" || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }
    if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: "Another account already uses this email" }, { status: 409 });
    }
    data.email = email;
  }

  if (Object.keys(data).length === 0) return NextResponse.json({ ok: true });

  await prisma.user.update({ where: { id: user.id }, data });
  if (data.email && user.stripeCustomerId) {
    await stripe.customers.update(user.stripeCustomerId, { email: data.email }).catch((e) => console.error("[account] stripe email sync failed", e));
  }
  await audit("account.profile", { userId: user.id, detail: { name: "name" in data, email: !!data.email }, req });
  return NextResponse.json({ ok: true });
}

/**
 * Delete the account: cancels any Stripe subscription immediately, then removes the
 * account with its stores, logs and metrics. Connectors fail closed on their next call.
 */
export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { password?: unknown; confirm?: unknown } | null;
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm" }, { status: 400 });
  }
  if (typeof body.password !== "string" || !(await bcrypt.compare(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const sub = user.subscription;
  if (sub && !["canceled", "incomplete_expired"].includes(sub.status)) {
    try {
      await stripe.subscriptions.cancel(sub.stripeSubId);
    } catch (error) {
      console.error("[account] stripe cancel failed", error);
      return NextResponse.json(
        { error: "The subscription could not be canceled with Stripe. Nothing was deleted — try again or contact support." },
        { status: 502 },
      );
    }
  }

  const stores = await prisma.store.count({ where: { userId: user.id } });
  await audit("account.deleted", { userId: user.id, target: user.email, detail: { stores }, req });
  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ deleted: true });
}
