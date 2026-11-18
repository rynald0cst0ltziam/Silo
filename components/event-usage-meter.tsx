"use client";

export function EventUsageMeter({
  used,
  max,
}: {
  used: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0;
  const isWarning = pct >= 80;
  const isCritical = pct >= 95;

  const barColor = isCritical
    ? "bg-red-500"
    : isWarning
      ? "bg-amber-400"
      : "bg-mint";

  const textColor = isCritical
    ? "text-red-400"
    : isWarning
      ? "text-amber-400"
      : "text-mint/70";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
          Monthly events
        </p>
        <p className={`font-mono text-[10px] ${textColor}`}>
          {used.toLocaleString()} / {max >= 1_000_000 ? `${(max / 1_000_000).toFixed(0)}M` : `${(max / 1_000).toFixed(0)}k`}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {isCritical && (
        <p className="mt-1 text-[9px] text-red-400/60">
          Approaching limit. Events will be rejected when reached.
        </p>
      )}
    </div>
  );
}
