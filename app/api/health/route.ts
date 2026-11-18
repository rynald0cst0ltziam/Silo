import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, { status: string; latency?: number }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    checks.database = { status: "healthy", latency: Date.now() - dbStart };
  } catch {
    checks.database = { status: "unhealthy", latency: Date.now() - dbStart };
  }

  // Store count
  try {
    const storeCount = await prisma.store.count();
    const activeStores = await prisma.store.count({
      where: { status: "optimized" },
    });
    checks.stores = {
      status: "healthy",
      ...({ total: storeCount, active: activeStores } as Record<string, unknown>),
    } as typeof checks.stores;
  } catch {
    checks.stores = { status: "unhealthy" };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");

  return NextResponse.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 },
  );
}
