"use client";

import { useStoreLive } from "@/components/live/store-live-provider";

/**
 * Requests served per heartbeat, split into cache hits, misses and session bypasses.
 */
export function TrafficTicker() {
  const { traffic } = useStoreLive();
  const W = 600;
  const H = 140;
  const slot = W / traffic.length;
  const bw = Math.max(3, slot - 4);
  const max = Math.max(4, ...traffic.map((p) => p.h + p.m + p.b));
  const recent = traffic.filter((p) => p.t > Date.now() - 60_000);
  const perMin = recent.reduce((s, p) => s + p.h + p.m + p.b, 0);
  const served = recent.reduce((s, p) => s + p.h + p.m, 0);
  const liveHit = served ? (recent.reduce((s, p) => s + p.h, 0) / served) * 100 : null;

  return (
    <div className="rounded-xl border border-white/8 bg-[#0b0d11] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-medium text-paper/65">Live traffic</p>
        <div className="flex items-center gap-3 font-mono text-[12px] text-paper/40">
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-accent" />hit</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-amber" />miss</span>
          <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-[2px] bg-white/30" />bypass</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-3 h-[140px] w-full" role="img" aria-label="Storefront requests over time">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(255,255,255,0.045)" />
        ))}
        {traffic.map((p, i) => {
          const x = i * slot + (slot - bw) / 2;
          let y = H;
          const segs: Array<[number, string]> = [
            [p.h, "#3d6bff"],
            [p.m, "rgba(244,166,58,0.85)"],
            [p.b, "rgba(255,255,255,0.22)"],
          ];
          const rects = segs
            .filter(([v]) => v > 0)
            .map(([v, fill], k) => {
              const h = Math.max(2, (v / max) * (H - 8));
              y -= h;
              return <rect key={k} x={x} y={y} width={bw} height={h} rx={2} fill={fill} className="transition-all duration-500" />;
            });
          return rects.length ? rects : <rect key={i} x={x} y={H - 2} width={bw} height={2} rx={1} fill="rgba(255,255,255,0.06)" />;
        })}
      </svg>
      <div className="mt-2.5 flex justify-between gap-2 border-t border-white/8 pt-2.5 font-mono text-[12.5px] text-paper/30">
        <span>{perMin ? `${perMin.toLocaleString()} requests in the last minute` : "Waiting for storefront traffic"}</span>
        <span>{liveHit !== null ? `live hit rate ${liveHit.toFixed(1)}%` : "updates every 3s"}</span>
      </div>
    </div>
  );
}
