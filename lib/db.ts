import { neon } from "@neondatabase/serverless";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

export type StoreRequest = {
  id: string;
  email: string;
  storeUrl: string;
  catalogSize: string;
  plan: string;
  createdAt: string;
};

let schemaReady = false;

function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

async function ensureSchema() {
  if (schemaReady || !process.env.DATABASE_URL) return;
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS store_requests (
      id text PRIMARY KEY,
      email text NOT NULL,
      store_url text NOT NULL,
      catalog_size text,
      plan text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS store_requests_created_at_idx
    ON store_requests (created_at DESC)
  `;

  schemaReady = true;
}

export async function saveStoreRequest(request: StoreRequest) {
  if (databaseConfigured()) {
    await ensureSchema();
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      INSERT INTO store_requests (id, email, store_url, catalog_size, plan, created_at)
      VALUES (
        ${request.id},
        ${request.email},
        ${request.storeUrl},
        ${request.catalogSize},
        ${request.plan},
        ${request.createdAt}
      )
    `;
    return;
  }

  if (process.env.NODE_ENV === "development" || !process.env.VERCEL) {
    const directory = path.join(process.cwd(), ".data");
    await mkdir(directory, { recursive: true });
    await appendFile(
      path.join(directory, "connect-requests.jsonl"),
      `${JSON.stringify(request)}\n`,
      "utf8",
    );
    return;
  }

  throw new Error("Store requests are not connected to a database.");
}
