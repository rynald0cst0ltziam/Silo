"use client";

interface EventRow {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  purgeUrls: string[];
  warmUrls: string[];
  processed: boolean;
  createdAt: string;
}

function formatTrigger(type: string): string {
  const map: Record<string, string> = {
    product_update: "product.updated",
    stock_change: "stock.changed",
    price_change: "price.updated",
    order_completed: "order.completed",
    order_refunded: "order.refunded",
    category_update: "category.updated",
    manual_purge: "manual.purge",
    variation_update: "variation.updated",
  };
  return map[type] ?? type.replace(/_/g, ".");
}

function extractObjectName(payload: Record<string, unknown> | null): string {
  if (!payload) return "—";
  return (
    (payload.product_name as string) ??
    (payload.title as string) ??
    (payload.name as string) ??
    (payload.object as string) ??
    "—"
  );
}

function extractDetail(
  type: string,
  payload: Record<string, unknown> | null
): string {
  if (!payload) return "";
  const parts: string[] = [];
  if (payload.variation) parts.push(String(payload.variation));
  if (payload.sku) parts.push(`SKU-${payload.sku}`);
  if (payload.product_id) parts.push(`#${payload.product_id}`);
  if (type === "category_update" && payload.count)
    parts.push(`${payload.count} products`);
  return parts.join(" · ") || "";
}

function formatDuration(createdAt: string): string {
  // Simulated processing time based on URL count
  return "—";
}

export function InvalidationLogTable({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[10px] text-paper/30">
        No events recorded yet. Connect the Silo connector plugin and events
        will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-white/7 font-mono text-[7px] uppercase tracking-[0.08em] text-paper/20">
            <th className="px-4 py-2 font-normal">Trigger</th>
            <th className="px-4 py-2 font-normal">Object</th>
            <th className="hidden px-4 py-2 font-normal sm:table-cell">
              Scope
            </th>
            <th className="hidden px-4 py-2 font-normal md:table-cell">
              Time
            </th>
            <th className="px-4 py-2 text-right font-normal">State</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => {
            const purgeCount = event.purgeUrls.length;
            const warmCount = event.warmUrls.length;
            const objectName = extractObjectName(event.payload);
            const detail = extractDetail(event.type, event.payload);
            const isWarmed = event.processed && warmCount > 0;
            const isWarming = !event.processed && warmCount > 0;

            return (
              <tr
                key={event.id}
                className="border-b border-white/5 last:border-0"
              >
                <td className="whitespace-nowrap px-4 py-2 font-mono text-[9px] text-accent/80">
                  {formatTrigger(event.type)}
                </td>
                <td className="px-4 py-2">
                  <p className="whitespace-nowrap text-[9px] text-paper/60">
                    {objectName}
                  </p>
                  {detail && (
                    <p className="font-mono text-[7px] text-paper/20">
                      {detail}
                    </p>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-2 font-mono text-[8px] text-paper/30 sm:table-cell">
                  {purgeCount > 0 ? `${purgeCount} URLs` : "—"}
                  {warmCount > 0 && ` · ${warmCount} warm`}
                </td>
                <td className="hidden whitespace-nowrap px-4 py-2 font-mono text-[8px] text-paper/25 md:table-cell">
                  {new Date(event.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[7px] ${
                      isWarming
                        ? "border-amber/20 bg-amber/8 text-amber/80"
                        : isWarmed
                          ? "border-mint/20 bg-mint/8 text-mint/75"
                          : "border-white/8 bg-white/[0.03] text-paper/30"
                    }`}
                  >
                    {isWarming
                      ? "Warming"
                      : isWarmed
                        ? "Re-warmed"
                        : "Purged"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
