import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { audit } from "@/lib/audit";
import { trialEnd } from "@/lib/entitlements";
import { TIERS } from "@/lib/tiers";

const DAY = 86_400_000;

type Body = {
  action?: string;
  days?: number;
  date?: string;
  plan?: string | null;
  reason?: string;
  role?: string;
  confirm?: string;
};

/**
 * Admin actions on one account. Every action is written to the account's audit log
 * with the admin as actor, so the customer can see it under Activity.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, include: { subscription: true } });
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const body = ((await req.json().catch(() => null)) ?? {}) as Body;
  const self = admin.id === user.id;
  const log = (action: string, detail: Record<string, unknown>) => audit(action, { userId: user.id, actorId: admin.id, target: user.email, detail, req });

  switch (body.action) {
    case "extend_trial": {
      const days = Math.round(Number(body.days));
      if (!Number.isFinite(days) || days < 1 || days > 365) return NextResponse.json({ error: "Days must be 1 to 365" }, { status: 400 });
      const base = Math.max(Date.now(), trialEnd(user).getTime());
      const next = new Date(base + days * DAY);
      await prisma.user.update({ where: { id }, data: { trialEndsAt: next } });
      await log("admin.trial", { days, trialEndsAt: next.toISOString() });
      return NextResponse.json({ ok: true });
    }

    case "end_trial": {
      const now = new Date();
      await prisma.user.update({ where: { id }, data: { trialEndsAt: now } });
      await log("admin.trial", { ended: now.toISOString() });
      return NextResponse.json({ ok: true });
    }

    case "set_plan": {
      const plan = body.plan ? String(body.plan) : null;
      if (plan && !(plan in TIERS)) return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
      await prisma.user.update({ where: { id }, data: { planOverride: plan } });
      await log("admin.plan", { plan: plan ?? "none" });
      return NextResponse.json({ ok: true });
    }

    case "suspend": {
      if (self) return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 400 });
      const reason = String(body.reason ?? "").trim().slice(0, 200);
      await prisma.user.update({ where: { id }, data: { suspendedAt: new Date(), suspendedReason: reason || null, sessionVersion: { increment: 1 } } });
      await log("admin.suspend", { reason });
      return NextResponse.json({ ok: true });
    }

    case "unsuspend": {
      await prisma.user.update({ where: { id }, data: { suspendedAt: null, suspendedReason: null } });
      await log("admin.unsuspend", {});
      return NextResponse.json({ ok: true });
    }

    case "set_role": {
      if (self) return NextResponse.json({ error: "You cannot change your own role" }, { status: 400 });
      const role = body.role === "admin" ? "admin" : "user";
      await prisma.user.update({ where: { id }, data: { role, sessionVersion: { increment: 1 } } });
      await log("admin.role", { role });
      return NextResponse.json({ ok: true });
    }

    case "signout": {
      await prisma.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
      await log("admin.signout", {});
      return NextResponse.json({ ok: true });
    }

    case "delete": {
      if (self) return NextResponse.json({ error: "Delete your own account from Account settings" }, { status: 400 });
      if (body.confirm?.trim().toLowerCase() !== user.email) return NextResponse.json({ error: "Type the account email to confirm" }, { status: 400 });
      const sub = user.subscription;
      if (sub && !["canceled", "incomplete_expired"].includes(sub.status)) {
        try {
          await stripe.subscriptions.cancel(sub.stripeSubId);
        } catch (error) {
          console.error("[admin] stripe cancel failed", error);
          return NextResponse.json({ error: "Stripe could not cancel the subscription. Nothing was deleted." }, { status: 502 });
        }
      }
      await log("admin.delete", { stores: await prisma.store.count({ where: { userId: id } }) });
      await prisma.user.delete({ where: { id } });
      return NextResponse.json({ ok: true, deleted: true });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
