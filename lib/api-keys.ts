import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "sk_silo_";
const KEY_BYTES = 24;

export function generateApiKey(): { plain: string; hash: string } {
  const raw = randomBytes(KEY_BYTES).toString("base64url");
  const plain = `${KEY_PREFIX}${raw}`;
  const hash = hashApiKey(plain);
  return { plain, hash };
}

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}
