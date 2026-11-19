import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.store.updateMany({
    where: {
      monthlyEventsReset: { lt: new Date() },
    },
    data: {
      monthlyEvents: 0,
      monthlyEventsReset: getNextMonth(),
    },
  });

  // Also reset stores that have never been reset
  const neverReset = await prisma.store.updateMany({
    where: {
      monthlyEventsReset: null,
    },
    data: {
      monthlyEvents: 0,
      monthlyEventsReset: getNextMonth(),
    },
  });

  return NextResponse.json({
    ok: true,
    reset: result.count + neverReset.count,
  });
}

function getNextMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}
