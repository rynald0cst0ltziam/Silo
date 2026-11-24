import { prisma } from "@/lib/prisma";
import { getUserTier } from "@/lib/tier-enforcement";
import { ACCESS_SELECT } from "@/lib/entitlements";
import { runCron } from "@/lib/cron";

const DAY = 86_400_000;

/** Nightly: trims store logs to each plan's retention, and housekeeping tables. */
export async function GET(req: Request) {
  return runCron(req, "cleanup", async () => {
    const stores = await prisma.store.findMany({ select: { id: true, user: { select: ACCESS_SELECT } } });

    let eventsDeleted = 0;
    let metricsDeleted = 0;
    let warmupJobsDeleted = 0;

    for (const store of stores) {
      const cutoff = new Date(Date.now() - getUserTier(store.user).logRetentionDays * DAY);
      const [events, metrics, warmup] = await Promise.all([
        prisma.event.deleteMany({ where: { storeId: store.id, createdAt: { lt: cutoff } } }),
        prisma.metric.deleteMany({ where: { storeId: store.id, date: { lt: cutoff } } }),
        prisma.warmupJob.deleteMany({
          where: { storeId: store.id, createdAt: { lt: cutoff }, status: { in: ["completed", "failed", "partial"] } },
        }),
      ]);
      eventsDeleted += events.count;
      metricsDeleted += metrics.count;
      warmupJobsDeleted += warmup.count;
    }

    const now = Date.now();
    const [tokens, cronRuns, audits] = await Promise.all([
      prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now - DAY) } } }),
      prisma.cronRun.deleteMany({ where: { createdAt: { lt: new Date(now - 30 * DAY) } } }),
      prisma.auditLog.deleteMany({ where: { createdAt: { lt: new Date(now - 400 * DAY) } } }),
    ]);

    return {
      stores: stores.length,
      eventsDeleted,
      metricsDeleted,
      warmupJobsDeleted,
      resetTokensDeleted: tokens.count,
      cronRunsDeleted: cronRuns.count,
      auditEntriesDeleted: audits.count,
    };
  });
}
