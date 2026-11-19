"use client";

import { useEffect, useRef } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Tween } from "@/components/live/tween";
import { cn } from "@/lib/utils";

type Stage = { key: string; label: string; state: "done" | "active" | "pending" | "failed" };
export type ScanState = {
  status?: string;
  origin?: string;
  stage?: string;
  stages?: Stage[];
  percent?: number;
  error?: string;
  counts?: Record<string, number>;
  types?: Record<string, number>;
  log?: Array<{ t: number; m: string }>;
  result?: { config_version?: number; tier?: string; warm_total?: number };
  finished_at?: number;
};

const NODES = 144;

/**
 * The catalog scan, rendered from the connector's live progress — the same scan the
 * merchant watches in WooCommerce → Silo.
 */
export function ScanPanel({ scan, compact = false }: { scan: ScanState; compact?: boolean }) {
  const status = scan.status ?? "idle";
  const pct = status === "complete" ? 100 : Math.round(scan.percent ?? 0);
  const counts = scan.counts ?? {};
  const lit = Math.round((pct / 100) * NODES);
  const prevLit = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    prevLit.current = lit;
  });
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [scan.log?.length]);

  const active = scan.stages?.find((s) => s.state === "active");
  const title =
    status === "complete" ? "Catalog mapped" : status === "failed" ? "Scan stopped" : status === "running" ? "Mapping the catalog" : "Waiting for scan";
  const sub =
    status === "complete"
      ? `Profile v${scan.result?.config_version ?? "—"} applied${scan.result?.tier ? ` · ${scan.result.tier} plan` : ""} · ${(counts.nodes ?? 0).toLocaleString()} graph nodes`
      : status === "failed"
        ? scan.error || "The scan could not finish."
        : `${active?.label ?? "Preparing"}… · started ${scan.origin === "silo" ? "from Silo" : "in WordPress"}`;

  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-paper/30">Catalog scan</p>
          <h3 className="mt-1 text-[24px] font-medium tracking-[-0.03em] text-paper">{title}</h3>
          <p className="mt-1 text-[14px] text-paper/45">{sub}</p>
        </div>
        <p className="font-display text-[44px] font-medium leading-none tracking-[-0.06em] text-paper">
          <Tween value={pct} />
          <span className="ml-0.5 text-[18px] text-paper/30">%</span>
        </p>
      </div>

      <div className="relative mt-4 h-1.5 overflow-hidden rounded-full bg-white/6">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out",
            status === "complete" ? "bg-mint" : status === "failed" ? "bg-rose" : "bg-gradient-to-r from-accent to-accent-hi shadow-[0_0_18px_rgba(61,107,255,0.55)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className={cn("mt-4 grid gap-3", compact ? "lg:grid-cols-[1fr_200px]" : "lg:grid-cols-[220px_1fr_200px]")}>
        {!compact && (
          <div className="space-y-1">
            {(scan.stages ?? []).map((s) => (
              <div
                key={s.key}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors",
                  s.state === "active" ? "bg-accent/10 text-paper" : s.state === "done" ? "text-paper/60" : "text-paper/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                    s.state === "done" ? "bg-mint/15 text-mint" : s.state === "failed" ? "bg-rose/15 text-rose" : s.state === "pending" ? "border border-white/15" : "",
                  )}
                >
                  {s.state === "done" && <Check className="h-2.5 w-2.5" />}
                  {s.state === "failed" && <X className="h-2.5 w-2.5" />}
                  {s.state === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-hi" />}
                </span>
                {s.label}
              </div>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-white/6 bg-white/[0.015] p-3">
          <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-paper/30">
            <span>catalog graph</span>
            <span>
              {(counts.nodes ?? 0).toLocaleString()} nodes · {(counts.edges ?? 0).toLocaleString()} edges
            </span>
          </div>
          <div className="mt-2.5 grid grid-cols-[repeat(24,minmax(0,1fr))] gap-[3px]">
            {Array.from({ length: NODES }).map((_, i) => {
              const on = i < lit;
              const kind = i % 7 === 0 ? "bg-accent/85 shadow-[0_0_8px_rgba(61,107,255,0.45)]" : i % 5 === 0 ? "bg-mint/60" : "bg-white/22";
              return (
                <span
                  key={i}
                  className={cn("aspect-square rounded-[2px] transition-all duration-500", on ? kind : "bg-white/6", on && i >= prevLit.current && "scale-110")}
                />
              );
            })}
          </div>
          {scan.types && Object.keys(scan.types).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(scan.types)
                .sort((a, b) => b[1] - a[1])
                .map(([type, n]) => (
                  <span key={type} className="rounded border border-accent/20 bg-accent/10 px-1.5 py-0.5 font-mono text-[12px] capitalize text-accent-hi">
                    {type.replace(/-/g, " ")} · {n.toLocaleString()}
                  </span>
                ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {[
            ["Products", counts.products],
            ["Variations", counts.variations],
            ["Archives", counts.archives],
            ["Store API routes", counts.routes],
            ["Priority URLs", counts.priority],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-baseline justify-between gap-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
              <span className="text-[13px] text-paper/45">{label}</span>
              <Tween value={Number(value ?? 0)} className="font-display text-[19px] tracking-[-0.04em] text-paper" />
            </div>
          ))}
        </div>
      </div>

      {(scan.log?.length ?? 0) > 0 && (
        <div ref={logRef} className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-white/6 bg-[#07080a] px-3 py-2.5 font-code text-[13px] leading-[1.85]">
          {scan.log!.map((line, i) => (
            <div key={`${line.t}-${i}`} className="flex gap-3">
              <span className="shrink-0 text-paper/20">{new Date(line.t * 1000).toLocaleTimeString()}</span>
              <span className={i === scan.log!.length - 1 ? "text-paper" : "text-paper/55"}>{line.m}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
