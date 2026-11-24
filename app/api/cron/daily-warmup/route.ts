import { runDailyPriorityWarmup } from "@/lib/warmup-processor";
import { runCron } from "@/lib/cron";

export async function GET(req: Request) {
  return runCron(req, "daily-warmup", async () => ({ ...(await runDailyPriorityWarmup()) }));
}
