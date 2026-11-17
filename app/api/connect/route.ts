import { NextResponse } from "next/server";
import { saveStoreRequest, type StoreRequest } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_REQUESTS;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Try again later or email hello@getsilo.com." },
      { status: 429 },
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (payload.website) {
    return NextResponse.json({ ok: true });
  }

  const email = String(payload.email ?? "").trim().toLowerCase();
  const storeUrl = String(payload.storeUrl ?? "").trim();
  const catalogSize = String(payload.catalogSize ?? "1k-10k");
  const plan = String(payload.plan ?? "Solo");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  let normalizedStoreUrl: string;
  try {
    const parsed = new URL(storeUrl);
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname.includes(".")) {
      throw new Error("Invalid URL");
    }
    normalizedStoreUrl = parsed.origin;
  } catch {
    return NextResponse.json({ error: "Enter a valid store URL." }, { status: 400 });
  }

  const record: StoreRequest = {
    id: crypto.randomUUID(),
    email,
    storeUrl: normalizedStoreUrl,
    catalogSize: catalogSize.slice(0, 32),
    plan: plan.slice(0, 32),
    createdAt: new Date().toISOString(),
  };

  try {
    await saveStoreRequest(record);
  } catch (error) {
    console.error("Failed to save store request", error);
    return NextResponse.json(
      {
        error:
          "We couldn't save your request. Email hello@getsilo.com and we'll set your store up manually.",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, id: record.id }, { status: 201 });
}
