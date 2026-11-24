import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Authenticate a Vercel Cron call, run the job and record the run for the admin console.
 * Fails closed when CRON_SECRET is not configured.
 */
export async function runCron(req: Request, name: string, job: () => Promise<Record<string, unknown>>) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  try {
    const result = await job();
    await prisma.cronRun
      .create({ data: { name, ok: true, ms: Date.now() - started, detail: result as Prisma.InputJsonValue } })
      .catch(() => undefined);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron:${name}]`, error);
    await prisma.cronRun
      .create({ data: { name, ok: false, ms: Date.now() - started, detail: { error: message.slice(0, 500) } } })
      .catch(() => undefined);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
