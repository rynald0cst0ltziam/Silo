"use client";

import { ArrowRight, ArrowUpRight, Zap } from "lucide-react";
import type { LiveEvent } from "@/lib/store-live";
import { STATE_STYLE, ago, ms } from "@/components/live/format";
import { cn } from "@/lib/utils";

type Desc = { sku?: string; variations?: Array<{ sku?: string; label?: string }>; urls?: Record<string, unknown>; store_api?: { mode?: string } };

/**
 * The most recent catalog event, drawn the way the product promises it: one fact,
 * the nodes it touched, and everything it left alone.
 */
export function LatestEventCard({ event, graphNodes }: { event: LiveEvent | undefined; graphNodes: number }) {
  if (!event) {
    return (
      <div className="rounded-xl border border-white/9 bg-[#0c0f13] p-4">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-accent/12 ring-1 ring-accent/20">
            <Zap className="h-3 w-3 text-accent-hi" />
          </span>
          <span className="font-code text-[13px] text-paper/60">waiting for the first catalog event</span>
        </div>
        <p className="mt-3 text-[13px] text-paper/40">
          Change a price or stock level in WooCommerce. The event, the nodes it invalidated and the re-warm appear here within seconds.
        </p>
      </div>
    );
  }

  const p = (event.payload ?? {}) as Desc & { items?: Desc[] };
  const first = p.items?.[0] ?? p;
  const sku = first.variations?.[0]?.sku || first.sku || "";
  const urls = (first.urls ?? {}) as Record<string, unknown>;
  const count = (k: string) => (Array.isArray(urls[k]) ? (urls[k] as unknown[]).length : 0);
  const archives = count("categories") + count("tags") + count("brands") + count("attributes") + (urls.shop ? 1 : 0);
  const products = p.items?.length ?? (urls.product ? 1 : 0);
  const apiMode = (p.store_api?.mode ?? (first as Desc).store_api?.mode) as string | undefined;
  const full = event.type === "purge.all" || event.type.startsWith("system.");

  const chain: string[] = full
    ? ["entire cache"]
    : [
        products ? `${products} product${products > 1 ? "s" : ""}` : "",
        archives ? `${archives} archive${archives > 1 ? "s" : ""}` : "",
        apiMode ? (apiMode === "collections" ? "Store API filter sets" : "Store API product") : "",
      ].filter(Boolean);
  const untouched = Math.max(0, graphNodes - event.purgeUrls.length);
  const style = STATE_STYLE[event.state] ?? STATE_STYLE.purged;

  return (
    <div className="rounded-xl border border-white/9 bg-[#0c0f13] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-accent/12 ring-1 ring-accent/20">
            <Zap className="h-3 w-3 text-accent-hi" />
          </span>
          <span className="truncate font-code text-[14px] text-paper/85">{event.type}</span>
          <span className="hidden truncate font-code text-[12.5px] text-paper/35 sm:inline">{sku || event.object}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[12px] text-paper/30">{ago(event.createdAt)}</span>
          <span className="font-code text-[14px] text-mint">{event.durationMs ? ms(event.durationMs) : "—"}</span>
        </div>
      </div>

      <p className="mt-2 truncate text-[14px] text-paper/70">
        {event.object}
        {event.detail && <span className="text-paper/35"> · {event.detail}</span>}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {chain.map((node, i) => (
          <div key={node} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="h-3 w-3 text-paper/20" />}
            <span className="rounded border border-white/9 bg-white/[0.02] px-2 py-0.5 font-mono text-[12px] text-paper/55">{node}</span>
          </div>
        ))}
        <span className={cn("ml-auto rounded border px-2 py-0.5 font-mono text-[12px]", style.cls)}>{style.label}</span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-2.5 font-mono text-[12.5px]">
        <span className="text-paper/40">
          {event.warmUrls.length ? `${event.warm?.done ?? 0}/${event.warmUrls.length} priority pages re-warmed` : `${event.purgeUrls.length} URLs purged`}
        </span>
        {graphNodes > 0 && !full && (
          <span className="hidden items-center gap-1 text-paper/50 sm:flex">
            {untouched.toLocaleString()} catalog nodes untouched
            <ArrowUpRight className="h-3 w-3" />
          </span>
        )}
      </div>
    </div>
  );
}
