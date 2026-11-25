import { prisma } from "@/lib/prisma";
import { ACCESS_SELECT, getAccess, trialEnd, trialEndLabel } from "@/lib/entitlements";
import { emailConfigured, sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { siteUrl } from "@/lib/utils";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Reminder goes out when 48 hours or less are left; "ended" only for trials that ended in the last 3 days. */
const REMIND_WITHIN = 2 * DAY;
const ENDED_WITHIN = 3 * DAY;

/** Reserved test domains never receive mail; sending to them only bounces and hurts deliverability. */
function undeliverable(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return !domain || /(^|\.)(example\.(com|org|net)|test|invalid|localhost|example)$/.test(domain);
}

function layout(heading: string, paragraphs: string[], cta: { label: string; href: string }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2a2c31">${p}</p>`).join("");
  return `<!doctype html><html><body style="margin:0;background:#f6f5f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f1;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e2dc">
<tr><td style="padding:28px 28px 8px"><span style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#08090b">silo</span><span style="display:inline-block;width:7px;height:7px;border-radius:7px;background:#1ed6a1;margin-left:2px;vertical-align:10px"></span></td></tr>
<tr><td style="padding:12px 28px 4px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#08090b">${heading}</h1>${body}
<p style="margin:22px 0 8px"><a href="${cta.href}" style="display:inline-block;background:#3d6bff;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px">${cta.label}</a></p></td></tr>
<tr><td style="padding:18px 28px 26px;font-size:12px;line-height:1.5;color:#8a8c92">You're receiving this because you have a Silo for WooCommerce account. Questions? Reply to this email.</td></tr>
</table></td></tr></table></body></html>`;
}

export function reminderEmail(name: string | null, endsLabel: string, billing: string) {
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const subject = "Your Silo trial ends in 2 days";
  const text = `${hi}

Your 7-day Silo trial ends on ${endsLabel}.

Choose a plan before then and caching keeps running without a gap. If you choose now, nothing is charged until the trial ends.

If the trial ends without a plan, Silo pauses caching on your store. Shoppers still see live pages (never stale ones), and caching switches straight back on when you pick a plan.

Choose a plan: ${billing}

Questions? Just reply to this email.`;
  const html = layout(
    "Your trial ends in 2 days",
    [
      hi,
      `Your 7-day Silo trial ends on <strong>${endsLabel}</strong>.`,
      "Choose a plan before then and caching keeps running without a gap. If you choose now, nothing is charged until the trial ends.",
      "If the trial ends without a plan, Silo pauses caching on your store. Shoppers still see live pages (never stale ones), and caching switches straight back on when you pick a plan.",
    ],
    { label: "Choose a plan", href: billing },
  );
  return { subject, text, html };
}

export function endedEmail(name: string | null, billing: string) {
  const hi = name ? `Hi ${name.split(" ")[0]},` : "Hi,";
  const subject = "Your Silo trial has ended";
  const text = `${hi}

Your 7-day Silo trial has ended, so caching is paused on your store.

Nothing is broken: your store is serving live pages, so shoppers never see stale stock or prices. Your settings, catalog map and logs are all kept.

Choose a plan and caching switches back on within a minute: ${billing}

Questions? Just reply to this email.`;
  const html = layout(
    "Your trial has ended",
    [
      hi,
      "Your 7-day Silo trial has ended, so caching is paused on your store.",
      "Nothing is broken: your store is serving live pages, so shoppers never see stale stock or prices. Your settings, catalog map and logs are all kept.",
      "Choose a plan and caching switches back on within a minute.",
    ],
    { label: "Choose a plan", href: billing },
  );
  return { subject, text, html };
}

/**
 * Hourly: email trial accounts once when their trial is about to end, and once when it has
 * ended. Paying, complimentary (including admins) and suspended accounts are never emailed.
 */
export async function runTrialEmails(options: { dryRun?: boolean } = {}) {
  const now = Date.now();
  const billing = `${siteUrl().replace(/\/+$/, "")}/dashboard/billing`;
  const candidates = await prisma.user.findMany({
    where: {
      suspendedAt: null,
      createdAt: { gte: new Date(now - 60 * DAY) },
      OR: [{ trialReminderSentAt: null }, { trialEndedEmailAt: null }],
    },
    select: { ...ACCESS_SELECT, id: true, email: true, name: true, trialReminderSentAt: true, trialEndedEmailAt: true },
  });

  const result = { checked: candidates.length, reminders: 0, ended: 0, failed: 0, skipped: !emailConfigured(), planned: [] as string[] };
  if (!emailConfigured() && !options.dryRun) return result;

  for (const user of candidates) {
    if (undeliverable(user.email)) continue;
    const access = getAccess(user);
    const ends = trialEnd(user).getTime();

    if (access.state === "trial" && !user.trialReminderSentAt && ends - now <= REMIND_WITHIN && ends > now) {
      result.planned.push(`reminder:${user.id}`);
      if (options.dryRun) continue;
      const mail = reminderEmail(user.name, trialEndLabel(access), billing);
      const ok = await sendEmail(user.email, mail.subject, mail.text, mail.html);
      if (ok) {
        await prisma.user.update({ where: { id: user.id }, data: { trialReminderSentAt: new Date() } });
        await audit("account.trial_reminder", { userId: user.id });
        result.reminders++;
      } else result.failed++;
      continue;
    }

    if (access.state === "expired" && !user.trialEndedEmailAt && now - ends <= ENDED_WITHIN && now >= ends) {
      result.planned.push(`ended:${user.id}`);
      if (options.dryRun) continue;
      const mail = endedEmail(user.name, billing);
      const ok = await sendEmail(user.email, mail.subject, mail.text, mail.html);
      if (ok) {
        await prisma.user.update({ where: { id: user.id }, data: { trialEndedEmailAt: new Date() } });
        await audit("account.trial_ended_email", { userId: user.id });
        result.ended++;
      } else result.failed++;
    }
  }
  return result;
}
