import { lookup } from "dns/promises";
import net from "net";

/**
 * Guards every request Silo's servers make to a store URL. Store URLs come from user
 * input and connector handshakes, so they must never reach loopback, private networks,
 * link-local ranges (cloud metadata) or other internal addresses.
 */

function ipv4Private(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function ipPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) return ipv4Private(ip);
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? ipv4Private(mapped[1]) : false;
}

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

export async function checkPublicUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Store URL must use http or https" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Store URL must not contain credentials" };
  }
  if (process.env.SILO_ALLOW_PRIVATE_STORES === "1") {
    return { ok: true, url };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "Store URL points to a local address" };
  }

  let addresses: string[];
  try {
    addresses = net.isIP(host) ? [host] : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  } catch {
    return { ok: false, reason: `Could not resolve ${host}` };
  }
  if (addresses.length === 0 || addresses.some(ipPrivate)) {
    return { ok: false, reason: "Store URL resolves to a private or internal address" };
  }
  return { ok: true, url };
}
