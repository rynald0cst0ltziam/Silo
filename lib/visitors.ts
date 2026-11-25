import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

/** Paths that are never counted: the product and private areas. */
const SKIP = /^\/(api|admin|dashboard|login|sign-in|sign-up|forgot-password|reset-password|_next)(\/|$)/;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|facebookexternalhit|preview|curl|wget|python|go-http|java\//i;

export function cleanPath(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 200 || !input.startsWith("/")) return null;
  const path = input.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  if (SKIP.test(path)) return null;
  return path;
}

/** Referrer host only, and never this site. */
export function cleanReferrer(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  try {
    const host = new URL(input).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || host === "heysilo.co" || host.endsWith(".vercel.app") || host === "localhost") return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/** Per-day visitor id: salted with the server secret and the day, so it can't be reversed or joined across days. */
export function visitorHash(ip: string, userAgent: string, day: string): string {
  const salt = process.env.AUTH_SECRET ?? "silo-visitors";
  return createHash("sha256").update(`${salt}|${day}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT.test(userAgent);
}

export async function recordPageView(input: { path: string; referrer: string | null; country: string | null; visitor: string; day: Date }) {
  await prisma.pageView.create({
    data: {
      day: input.day,
      path: input.path,
      referrer: input.referrer,
      country: input.country,
      visitor: input.visitor,
    },
  });
}
