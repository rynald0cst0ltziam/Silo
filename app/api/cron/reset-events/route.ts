import { prisma } from "@/lib/prisma";
import { runCron } from "@/lib/cron";

/** Monthly event allowance resets on the 1st (UTC). */
export async function GET(req: Request) {
  return runCron(req, "reset-events", async () => {
    const now = new Date();
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const result = await prisma.store.updateMany({
      where: { OR: [{ monthlyEventsReset: { lte: now } }, { monthlyEventsReset: null }] },
      data: { monthlyEvents: 0, monthlyEventsReset: next },
    });
    return { reset: result.count };
  });
}
