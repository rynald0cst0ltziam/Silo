"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { LiveEvent, LiveWarmJob } from "@/lib/store-live";
import { STATE_STYLE, ago, ms, pathOf } from "@/components/live/format";
import { cn } from "@/lib/utils";

/**
 * Invalidation log: trigger, object, scope, graph-walk time and re-warm state.
 * Rows expand into the full trace with purged and re-warmed URLs.
 */
export function EventFeed({ events, jobs = [], showTime = false }: { events: LiveEvent[]; jobs?: LiveWarmJob[]; showTime?: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(events.map((e) => e.id));
      return;
    }
    const added = events.filter((e) => !seen.current!.has(e.id)).map((e) => e.id);
    added.forEach((id) => seen.current!.add(id));
    if (added.length) {
      setFresh(new Set(added));
      const t = setTimeout(() => setFresh(new Set()), 2400);
      return () => clearTimeout(t);
    }
  }, [events]);

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (events.length === 0) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[15px] text-paper/50">No invalidations yet</p>
        <p className="mt-1 text-[14px] text-paper/30">Change a product, its stock or price in WooCommerce and the event appears here within seconds.</p>
      </div>
    );
  }

  const cols = showTime ? 6 : 5;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <thead>
          <tr className="border-b border-white/7 font-mono text-[12px] uppercase tracking-[0.08em] text-paper/25">
            <th className="px-4 py-2 font-normal">Trigger</th>
            <th className="px-4 py-2 font-normal">Object</th>
            <th className="px-4 py-2 font-normal">Scope</th>
            <th className="px-4 py-2 font-normal">Duration</th>
            {showTime && <th className="px-4 py-2 font-normal">When</th>}
            <th className="px-4 py-2 text-right font-normal">State</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            const style = STATE_STYLE[e.state] ?? STATE_STYLE.purged;
            const isOpen = open.has(e.id);
            const full = e.type === "purge.all" || e.type.startsWith("system.");
            return (
              <Fragment key={e.id}>
                <tr
                  onClick={() => toggle(e.id)}
                  className={cn(
                    "cursor-pointer border-b border-white/5 transition-colors hover:bg-white/[0.02]",
                    fresh.has(e.id) && "animate-[silo-new_2.4s_ease]",
                  )}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-code text-[13px] text-accent-hi/90">
                    <span className={cn("mr-1.5 inline-block text-paper/20 transition-transform", isOpen && "rotate-90")}>▸</span>
                    {e.type}
                  </td>
                  <td className="max-w-[280px] px-4 py-2.5">
                    <p className="truncate text-[14px] text-paper/75">{e.object ?? "—"}</p>
                    {e.detail && <p className="truncate font-mono text-[12.5px] text-paper/30">{e.detail}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13.5px] text-paper/40">
                    {full ? "full purge" : `${e.purgeUrls.length} URLs`}
                    {e.warmUrls.length > 0 && ` · ${e.warmUrls.length} warm`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13.5px] text-paper/40">{e.durationMs ? ms(e.durationMs) : "—"}</td>
                  {showTime && (
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[13.5px] text-paper/30" title={new Date(e.createdAt).toLocaleString()}>
                      {ago(e.createdAt)}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[12.5px]", style.cls)}>
                      {(e.state === "warming" || e.state === "queued") && <span className="h-1 w-1 animate-pulse rounded-full bg-current" />}
                      {style.label}
                      {e.warm && e.state === "warming" ? ` ${e.warm.done}/${e.warm.total}` : ""}
                    </span>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-white/5">
                    <td colSpan={cols} className="bg-white/[0.015] px-4 py-4">
                      <EventDetail event={e} job={jobs.find((j) => j.eventId === e.id)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventDetail({ event, job }: { event: LiveEvent; job?: LiveWarmJob }) {
  const results = new Map((job?.results ?? []).map((r) => [r.url, r]));
  const trace: Array<[string, string, string]> = [
    ["0ms", `${event.type} received from the connector`, "ok"],
  ];
  if (event.localMs) trace.push([`+${ms(event.localMs)}`, "purged on-site before Silo was asked", "ok"]);
  trace.push([`+${ms(event.durationMs)}`, `graph walk · ${event.purgeUrls.length} URLs resolved`, "ok"]);
  if (event.warmUrls.length) {
    trace.push(["", `warm.queue(${event.warmUrls.length} priority URLs)`, event.state === "warm" ? "complete" : event.state === "warming" ? "running" : event.state]);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">Event trace</p>
        <div className="mt-2 space-y-1.5 font-code text-[13px]">
          {trace.map(([t, label, state], i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-paper/25">{t}</span>
              <span className="flex-1 truncate text-paper/60">{label}</span>
              <span className={state === "ok" || state === "complete" ? "text-mint/70" : "text-amber/75"}>{state}</span>
            </div>
          ))}
        </div>
      </div>
      <UrlBox title={`Purged (${event.purgeUrls.length})`} urls={event.purgeUrls} empty={event.type === "purge.all" ? "Entire cache" : "None"} />
      <div>
        <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">Re-warmed ({event.warmUrls.length})</p>
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-white/5 bg-black/25 p-2">
          {event.warmUrls.length === 0 && <p className="font-code text-[13px] text-paper/30">None</p>}
          {event.warmUrls.map((u) => {
            const r = results.get(u);
            return (
              <p key={u} className="flex justify-between gap-3 font-code text-[13px] leading-[1.8]" title={u}>
                <span className="truncate text-mint/60">{pathOf(u)}</span>
                <span className={cn("shrink-0", r?.status === "failed" ? "text-rose/70" : "text-paper/30")}>{r ? (r.status === "warm" ? ms(r.ms) : r.error || r.status) : "pending"}</span>
              </p>
            );
          })}
        </div>
      </div>
      {event.payload && (
        <div>
          <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">Payload</p>
          <pre className="mt-2 max-h-40 overflow-auto rounded border border-white/5 bg-black/25 p-2 font-code text-[13px] text-paper/40">{JSON.stringify(event.payload, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function UrlBox({ title, urls, empty }: { title: string; urls: string[]; empty: string }) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-wider text-paper/25">{title}</p>
      <div className="mt-2 max-h-40 overflow-y-auto rounded border border-white/5 bg-black/25 p-2">
        {urls.length === 0 && <p className="font-code text-[13px] text-paper/30">{empty}</p>}
        {urls.map((u) => (
          <p key={u} className="truncate font-code text-[13px] leading-[1.8] text-paper/45" title={u}>
            {pathOf(u)}
          </p>
        ))}
      </div>
    </div>
  );
}
