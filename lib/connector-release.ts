import { promises as fs } from "fs";
import path from "path";

/**
 * Version of the connector this deployment serves, read from the plugin header so it can
 * never drift from what /api/connector/download actually zips.
 */
export async function latestConnectorVersion(): Promise<string | null> {
  try {
    const main = await fs.readFile(path.join(process.cwd(), "silo-connector", "silo-connector.php"), "utf8");
    return main.match(/^\s*\*\s*Version:\s*([0-9][0-9.]*)/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

/** True when `installed` is older than `latest` (dotted numeric versions). */
export function isOutdated(installed: string | null | undefined, latest: string | null): boolean {
  if (!installed || !latest) return false;
  const a = installed.split(".").map(Number);
  const b = latest.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
