import { processWarmupJobs } from "@/lib/warmup-processor";
import { runCron } from "@/lib/cron";

export async function GET(req: Request) {
  return runCron(req, "warmup", async () => ({ ...(await processWarmupJobs(10)) }));
}
