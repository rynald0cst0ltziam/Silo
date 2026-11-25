import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

export function clientIp(req?: Request | null): string | null {
  if (!req) return null;
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
}

/**
 * Record an account or admin action. Never throws: an audit write must not break the action itself.
 */
export async function audit(
  action: string,
  opts: { userId?: string | null; actorId?: string | null; target?: string | null; detail?: Record<string, unknown>; req?: Request | null } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: action.slice(0, 64),
        userId: opts.userId ?? null,
        actorId: opts.actorId ?? opts.userId ?? null,
        target: opts.target ? opts.target.slice(0, 191) : null,
        detail: (opts.detail ?? undefined) as Prisma.InputJsonValue | undefined,
        ip: clientIp(opts.req),
      },
    });
  } catch (error) {
    console.error("[audit] write failed", action, error);
  }
}

/** Plain-language labels for the activity log. */
export const AUDIT_LABELS: Record<string, string> = {
  "account.created": "Account created",
  "account.login": "Signed in",
  "account.login_failed": "Failed sign-in attempt",
  "account.profile": "Profile updated",
  "account.password": "Password changed",
  "account.password_reset_requested": "Password reset requested",
  "account.password_reset": "Password reset with emailed link",
  "account.signout_all": "Signed out of every browser",
  "account.deleted": "Account deleted",
  "account.trial_reminder": "Emailed: trial ends in 2 days",
  "account.trial_ended_email": "Emailed: trial has ended",
  "billing.checkout": "Checkout started",
  "billing.subscription": "Subscription updated",
  "billing.canceled": "Subscription ended",
  "billing.payment_failed": "Payment failed",
  "billing.invoice_paid": "Invoice paid",
  "store.created": "Store added",
  "store.deleted": "Store removed",
  "store.key_regenerated": "Store key regenerated",
  "store.purged": "Cache purged from dashboard",
  "store.rescan": "Rescan requested",
  "admin.role": "Role changed by admin",
  "admin.trial": "Trial changed by admin",
  "admin.plan": "Complimentary plan changed by admin",
  "admin.suspend": "Suspended by admin",
  "admin.unsuspend": "Suspension lifted by admin",
  "admin.delete": "Deleted by admin",
  "admin.signout": "Signed out everywhere by admin",
};
