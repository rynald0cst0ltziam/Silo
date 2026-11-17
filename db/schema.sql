-- Run this in your Neon SQL editor, or let the first API request create it.
CREATE TABLE IF NOT EXISTS store_requests (
  id text PRIMARY KEY,
  email text NOT NULL,
  store_url text NOT NULL,
  catalog_size text,
  plan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_requests_created_at_idx
  ON store_requests (created_at DESC);
