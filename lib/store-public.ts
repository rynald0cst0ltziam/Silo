import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Store fields safe to return to the browser. The store key is shown once at creation
 * and never returned again.
 */
export const PUBLIC_STORE_SELECT = {
  id: true,
  name: true,
  url: true,
  status: true,
  configVersion: true,
  lastScanAt: true,
  lastEventAt: true,
  lastSeenAt: true,
  hitRate: true,
  monthlyEvents: true,
  connectorVersion: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StoreSelect;
