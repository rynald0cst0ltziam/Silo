"use client";

import { useState } from "react";

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
    product_updated: "product.updated",
    stock_changed: "stock.changed",
    product_props_updated: "props.updated",
    order_status_changed: "order.changed",
    variation_created: "variation.created",
    sale_boundary: "sale.boundary",
    manual_purge: "manual.purge",
    connector_purge_all: "purge.all",
  };
  return map[type] ?? type.replace(/_/g, ".");
}

function extractObjectName(payload: Record<string, unknown> | null): string {
  if (!payload) return "—";
  return (
    (payload.name as string) ??
    (payload.product_name as string) ??
    (payload.title as string) ??
    (payload.object as string) ??
    (payload.product_id ? `Product #${payload.product_id}` : null) ??
    (payload.order_id ? `Order #${payload.order_id}` : null) ??
    "—"
  );
}

function extractDetail(
  type: string,
  payload: Record<string, unknown> | null,
): string {
  if (!payload) return "";
  const parts: string[] = [];
  if (payload.product_type) parts.push(String(payload.product_type));
  if (payload.sku) parts.push(`SKU ${payload.sku}`);
  if (payload.stock_quantity !== undefined)
    parts.push(`qty: ${payload.stock_quantity}`);
  if (payload.stock_status) parts.push(String(payload.stock_status));
  if (payload.updated_props && Array.isArray(payload.updated_props))
    parts.push(payload.updated_props.join(", "));
  if (payload.from && payload.to)
    parts.push(`${payload.from} → ${payload.to}`);
  if (payload.purgeAll) parts.push("full purge");
  return parts.join(" · ") || "";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function ExpandedRow({ event }: { event: EventRow }) {
  return (
    <tr className="border-b border-white/5">
      <td colSpan={5} className="bg-white/[0.015] px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {event.purgeUrls.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-paper/25">
                Purged URLs ({event.purgeUrls.length})
              </p>
              <div className="max-h-28 overflow-y-auto rounded border border-white/5 bg-black/20 p-2">
                {event.purgeUrls.map((url, i) => (
                  <p
                    key={i}
                    className="truncate font-mono text-[12px] text-paper/40"
                  >
                    {url}
                  </p>
                ))}
              </div>
            </div>
          )}
          {event.warmUrls.length > 0 && (
            <div>
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-paper/25">
                Warm URLs ({event.warmUrls.length})
              </p>
              <div className="max-h-28 overflow-y-auto rounded border border-white/5 bg-black/20 p-2">
                {event.warmUrls.map((url, i) => (
                  <p
                    key={i}
                    className="truncate font-mono text-[12px] text-mint/40"
                  >
                    {url}
                  </p>
                ))}
              </div>
            </div>
          )}
          {event.payload && Object.keys(event.payload).length > 0 && (
            <div className="sm:col-span-2">
              <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-paper/25">
                Payload
              </p>
              <div className="max-h-28 overflow-y-auto rounded border border-white/5 bg-black/20 p-2">
                <pre className="font-mono text-[12px] text-paper/35">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function InvalidationLogTable({ events }: { events: EventRow[] }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (events.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-[12px] text-paper/30">
        No events recorded yet. Connect the Silo connector plugin and events
        will appear here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-white/7 font-mono text-[11px] uppercase tracking-[0.08em] text-paper/20">
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
            const expanded = expandedIds.has(event.id);

            return (
              <>
                <tr
                  key={event.id}
                  className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.02] last:border-0"
                  onClick={() => toggle(event.id)}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] text-accent/80">
                    <span className="mr-1.5 inline-block text-[11px] text-paper/20 transition-transform" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      ▶
                    </span>
                    {formatTrigger(event.type)}
                  </td>
                  <td className="px-4 py-2">
                    <p className="whitespace-nowrap text-[11px] text-paper/60">
                      {objectName}
                    </p>
                    {detail && (
                      <p className="font-mono text-[11px] text-paper/20">
                        {detail}
                      </p>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-2 font-mono text-[12px] text-paper/30 sm:table-cell">
                    {purgeCount > 0 ? `${purgeCount} URLs` : "—"}
                    {warmCount > 0 && ` · ${warmCount} warm`}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-2 font-mono text-[12px] text-paper/25 md:table-cell">
                    <span title={new Date(event.createdAt).toLocaleString()}>
                      {timeAgo(event.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[11px] ${
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
                {expanded && <ExpandedRow key={`${event.id}-detail`} event={event} />}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
