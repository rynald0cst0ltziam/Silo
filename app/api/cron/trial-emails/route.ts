import { runCron } from "@/lib/cron";
import { runTrialEmails } from "@/lib/trial-emails";

/** Hourly: "trial ends in 2 days" and "trial has ended" emails, each sent once per account. */
export async function GET(req: Request) {
  return runCron(req, "trial-emails", async () => {
    const r = await runTrialEmails();
    return { checked: r.checked, reminders: r.reminders, ended: r.ended, failed: r.failed, emailOff: r.skipped };
  });
}
