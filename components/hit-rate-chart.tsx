"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MetricPoint {
  date: string;
  hits: number;
  misses: number;
  hitRate: number;
}

export function HitRateChart({ data }: { data: MetricPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-paper/30">
        No metrics data yet. Data appears after the connector reports hits.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="hitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tick={{ fontSize: 13, fill: "rgba(255,255,255,0.25)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 13, fill: "rgba(255,255,255,0.25)" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#0b0d11",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 14,
            color: "rgba(255,255,255,0.7)",
          }}
          formatter={(value) => [`${Number(value).toFixed(1)}%`, "Hit rate"]}
          labelFormatter={(label) => String(label)}
        />
        <Area
          type="monotone"
          dataKey="hitRate"
          stroke="#34d399"
          strokeWidth={1.5}
          fill="url(#hitGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
