"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { StoreLive } from "@/lib/store-live";

type TrafficPoint = { h: number; m: number; b: number; t: number };

type Ctx = {
  data: StoreLive;
  refresh: () => Promise<void>;
  updatedAt: number | null;
  error: string | null;
  traffic: TrafficPoint[];
};

const StoreLiveContext = createContext<Ctx | null>(null);
const POLL_MS = 3000;
const SERIES = 40;

export function useStoreLive(): Ctx {
  const ctx = useContext(StoreLiveContext);
  if (!ctx) throw new Error("useStoreLive must be used inside StoreLiveProvider");
  return ctx;
}

const emptySeries = (): TrafficPoint[] => Array.from({ length: SERIES }, () => ({ h: 0, m: 0, b: 0, t: 0 }));

/**
 * Polls /api/stores/[id]/live every 3 seconds while the tab is visible and derives a
 * live request series from the connector's cumulative counters.
 */
export function StoreLiveProvider({
  storeId,
  initial,
  events = 25,
  children,
}: {
  storeId: string;
  initial: StoreLive;
  events?: number;
  children: ReactNode;
}) {
  const [data, setData] = useState<StoreLive>(initial);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [traffic, setTraffic] = useState<TrafficPoint[]>(emptySeries);
  const prev = useRef<{ epoch?: string; hits: number; misses: number; bypass: number; at?: string } | null>(
    initial.stats ? { epoch: initial.stats.epoch, hits: initial.stats.hits, misses: initial.stats.misses, bypass: initial.stats.bypass, at: initial.stats.received_at } : null,
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/stores/${storeId}/live?events=${events}`, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Session expired — sign in again" : `Live data unavailable (HTTP ${res.status})`);
      const next = (await res.json()) as StoreLive;
      const s = next.stats;
      const p = prev.current;
      if (s && p && p.epoch === s.epoch) {
        if (s.received_at !== p.at) {
          setTraffic((series) =>
            [...series, { h: Math.max(0, s.hits - p.hits), m: Math.max(0, s.misses - p.misses), b: Math.max(0, s.bypass - p.bypass), t: Date.now() }].slice(-SERIES),
          );
        }
      } else if (s && p && p.epoch !== s.epoch) {
        setTraffic(emptySeries());
      }
      prev.current = s ? { epoch: s.epoch, hits: s.hits, misses: s.misses, bypass: s.bypass, at: s.received_at } : null;
      setData(next);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Live data unavailable");
    }
  }, [storeId, events]);

  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      if (stopped) return;
      if (!document.hidden) await refresh();
      timer.current = setTimeout(loop, POLL_MS);
    };
    const onVisible = () => {
      if (!document.hidden) {
        if (timer.current) clearTimeout(timer.current);
        loop();
      }
    };
    setUpdatedAt(Date.now());
    timer.current = setTimeout(loop, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return <StoreLiveContext.Provider value={{ data, refresh, updatedAt, error, traffic }}>{children}</StoreLiveContext.Provider>;
}
