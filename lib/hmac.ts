import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStoreAccess, type StoreAccess } from "@/lib/entitlements";
import { siteUrl } from "@/lib/utils";

export type ConnectorStore = {
  id: string;
  userId: string;
  name: string;
  url: string;
  apiKey: string;
  status: string;
  configVersion: number;
};

const STORE_SELECT = {
  id: true,
  userId: true,
  name: true,
  url: true,
  apiKey: true,
  status: true,
  configVersion: true,
} as const;

/**
 * Authenticate a signed connector request.
 *
 * Connectors send X-Silo-Key-Id (sha256 of the store key), a unix timestamp and an
 * HMAC-SHA256 of "{timestamp}.{body}". Older connectors sent the key itself in
 * X-Silo-Store-Key; that is still accepted.
 */
export async function readConnectorRequest<T = Record<string, unknown>>(
  req: Request,
  options: { allowInactive?: boolean } = {},
): Promise<{ ok: true; store: ConnectorStore; body: T; access: StoreAccess } | { ok: false; response: NextResponse }> {
  const signature = req.headers.get("x-silo-signature");
  const timestamp = req.headers.get("x-silo-timestamp");
  const keyId = req.headers.get("x-silo-key-id");
  const legacyKey = req.headers.get("x-silo-store-key");

  if (!signature || !timestamp || (!keyId && !legacyKey)) {
    return deny("Missing Silo signature headers", 401);
  }

  const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(skew) || skew > 300) {
    return deny("Request timestamp is outside the 5 minute window — check the store server clock", 401);
  }

  const store = keyId
    ? await prisma.store.findFirst({ where: { apiKeyHash: keyId }, select: STORE_SELECT })
    : await prisma.store.findFirst({ where: { apiKey: legacyKey! }, select: STORE_SELECT });

  if (!store) {
    return deny("Unknown store key — copy it again from your Silo dashboard", 401);
  }

  const raw = await req.text();
  const expected = createHmac("sha256", store.apiKey).update(`${timestamp}.${raw}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
    return deny("Invalid request signature", 401);
  }

  let body: T;
  try {
    body = (raw ? JSON.parse(raw) : {}) as T;
  } catch {
    return deny("Body is not valid JSON", 400);
  }

  // Plan gate. 403 makes the connector fail closed: it stops serving cached pages
  // (nothing could invalidate them) and switches back on at the first 200.
  const access = await getStoreAccess(store.id, store.userId);
  if (!access) return deny("Account not found", 401);
  if (!access.storeActive && !options.allowInactive) {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          error: access.storeMessage,
          code: "PLAN_INACTIVE",
          plan: {
            state: access.active ? "store_paused" : access.state,
            active: false,
            tier: access.tier.name,
            message: access.storeMessage,
            billing_url: `${siteUrl().replace(/\/+$/, "")}/dashboard/billing`,
          },
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, store, body, access };
}

function deny(error: string, status: number, code?: string) {
  return { ok: false as const, response: NextResponse.json(code ? { error, code } : { error }, { status }) };
}

/**
 * Backwards-compatible wrapper used by routes that only need the store identity.
 */
export async function verifyConnectorRequest(
  request: Request,
): Promise<{ storeId: string; userId: string } | null> {
  const result = await readConnectorRequest(request);
  return result.ok ? { storeId: result.store.id, userId: result.store.userId } : null;
}
