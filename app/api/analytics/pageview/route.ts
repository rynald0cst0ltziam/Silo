import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { utcDay } from "@/lib/connector";
import { cleanPath, cleanReferrer, isBot, recordPageView, visitorHash } from "@/lib/visitors";

export const runtime = "nodejs";

/**
 * Receives one page view from the browser. Stores no cookies and no raw IP or user agent.
 * Always answers 204 so the page is never affected by analytics.
 */
export async function POST(req: Request) {
  const userAgent = req.headers.get("user-agent") ?? "";
  if (isBot(userAgent) || req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1") {
    return new NextResponse(null, { status: 204 });
  }

  const rl = rateLimit(req);
  if (!rl.allowed) return new NextResponse(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const path = cleanPath(body.path);
  if (path) {
    const now = new Date();
    const day = utcDay(now);
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
    try {
      await recordPageView({
        path,
        referrer: cleanReferrer(body.referrer),
        country: (req.headers.get("x-vercel-ip-country") ?? "").slice(0, 2) || null,
        visitor: visitorHash(ip, userAgent, day.toISOString().slice(0, 10)),
        day,
      });
    } catch (error) {
      console.error("[analytics] page view not stored", error);
    }
  }
  return new NextResponse(null, { status: 204 });
}
