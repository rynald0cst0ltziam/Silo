import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readConnectorRequest } from "@/lib/hmac";
import { rateLimit } from "@/lib/rate-limit";
import { checkPublicUrl } from "@/lib/url-guard";

type Handshake = {
  site_url?: string;
  home_url?: string;
  connector_version?: string;
  wp_version?: string;
  wc_version?: string;
  php_version?: string;
};

/**
 * First call a connector makes with a pasted key: proves the key, returns the store
 * identity and plan, and records where the connector actually lives.
 */
export async function POST(req: Request) {
  const auth = await readConnectorRequest<Handshake>(req);
  if (!auth.ok) return auth.response;
  const { store, body } = auth;

  const rl = rateLimit(req, store.id);
  if (!rl.allowed) return rl.response!;

  const tier = auth.access.tier;

  let origin = store.url;
  try {
    if (body.home_url) origin = new URL(body.home_url).origin;
  } catch {
    origin = store.url;
  }
  if (origin !== store.url) {
    const check = await checkPublicUrl(origin);
    if (!check.ok) {
      return NextResponse.json({ error: `This store's address can't be used: ${check.reason}.` }, { status: 400 });
    }
  }

  await prisma.store.update({
    where: { id: store.id },
    data: {
      url: origin,
      lastSeenAt: new Date(),
      connectorVersion: body.connector_version ? String(body.connector_version).slice(0, 20) : undefined,
      connectorEnv: {
        wp: body.wp_version ?? null,
        wc: body.wc_version ?? null,
        php: body.php_version ?? null,
        site_url: body.site_url ?? null,
      },
      ...(store.status === "pending" || store.status === "offline" ? { status: "scanning" } : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    store: {
      id: store.id,
      name: store.name,
      url: origin,
      tier: tier.slug,
      tier_name: tier.name,
      previous_url: origin !== store.url ? store.url : null,
    },
  });
}
