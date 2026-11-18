import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export async function verifyConnectorRequest(
  request: Request,
): Promise<{ storeId: string; userId: string } | null> {
  const signature = request.headers.get("x-silo-signature");
  const timestamp = request.headers.get("x-silo-timestamp");
  const storeKey = request.headers.get("x-silo-store-key");

  if (!signature || !timestamp || !storeKey) {
    return null;
  }

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) {
    return null;
  }

  const store = await prisma.store.findFirst({
    where: { apiKey: storeKey },
  });

  if (!store) {
    return null;
  }

  const body = await request.text();
  const payload = `${timestamp}.${body}`;
  const expected = createHmac("sha256", storeKey).update(payload).digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const signatureBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
    return null;
  }

  return { storeId: store.id, userId: store.userId };
}

export function parseVerifiedBody<T>(request: Request): Promise<T> {
  return request.json();
}
