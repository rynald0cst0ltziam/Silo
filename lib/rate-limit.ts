import { NextResponse } from "next/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, RateLimitEntry>();
const ips = new Map<string, RateLimitEntry>();

const STORE_LIMIT = 120;
const STORE_WINDOW_MS = 60_000;
const IP_LIMIT = 300;
const IP_WINDOW_MS = 60_000;

function checkLimit(
  map: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    map.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function rateLimit(
  req: Request,
  storeId?: string,
): { allowed: boolean; response?: NextResponse } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? req.headers.get("x-real-ip")
    ?? "unknown";

  const ipCheck = checkLimit(ips, ip, IP_LIMIT, IP_WINDOW_MS);
  if (!ipCheck.allowed) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: Math.ceil((ipCheck.resetAt - Date.now()) / 1000) },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((ipCheck.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(IP_LIMIT),
            "X-RateLimit-Remaining": "0",
          },
        },
      ),
    };
  }

  if (storeId) {
    const storeCheck = checkLimit(stores, storeId, STORE_LIMIT, STORE_WINDOW_MS);
    if (!storeCheck.allowed) {
      return {
        allowed: false,
        response: NextResponse.json(
          { error: "Store rate limit exceeded", retryAfter: Math.ceil((storeCheck.resetAt - Date.now()) / 1000) },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((storeCheck.resetAt - Date.now()) / 1000)),
              "X-RateLimit-Limit": String(STORE_LIMIT),
              "X-RateLimit-Remaining": "0",
            },
          },
        ),
      };
    }
  }

  return { allowed: true };
}

// Periodic cleanup of expired entries (runs on import, every 5 min)
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [key, entry] of stores) {
      if (now > entry.resetAt) stores.delete(key);
    }
    for (const [key, entry] of ips) {
      if (now > entry.resetAt) ips.delete(key);
    }
  };
  setInterval(cleanup, 300_000).unref?.();
}
