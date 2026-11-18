"use client";

import { CheckCircle2, AlertTriangle, XCircle, Wifi, WifiOff } from "lucide-react";

interface HealthProps {
  status: string;
  lastSeenAt: string | null;
  lastEventAt: string | null;
  monthlyEvents: number;
  maxMonthlyEvents: number;
}

export function HealthIndicators({
  status,
  lastSeenAt,
  lastEventAt,
  monthlyEvents,
  maxMonthlyEvents,
}: HealthProps) {
  const indicators = getIndicators({ status, lastSeenAt, lastEventAt, monthlyEvents, maxMonthlyEvents });

  return (
    <div className="flex flex-wrap gap-2">
      {indicators.map((ind) => (
        <div
          key={ind.label}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-medium ${ind.style}`}
        >
          {ind.icon}
          {ind.label}
        </div>
      ))}
    </div>
  );
}

function getIndicators(props: HealthProps) {
  const indicators: Array<{
    label: string;
    icon: React.ReactNode;
    style: string;
  }> = [];

  // Connector status
  if (props.lastSeenAt) {
    const minutesAgo = (Date.now() - new Date(props.lastSeenAt).getTime()) / 60000;
    if (minutesAgo < 15) {
      indicators.push({
        label: "Connector online",
        icon: <Wifi className="h-3 w-3" />,
        style: "border-mint/20 text-mint/70 bg-mint/[0.04]",
      });
    } else {
      indicators.push({
        label: `Last seen ${formatAgo(props.lastSeenAt)}`,
        icon: <WifiOff className="h-3 w-3" />,
        style: "border-amber-500/20 text-amber-400/70 bg-amber-500/[0.04]",
      });
    }
  } else {
    indicators.push({
      label: "Not connected",
      icon: <XCircle className="h-3 w-3" />,
      style: "border-red-500/20 text-red-400/70 bg-red-500/[0.04]",
    });
  }

  // Store status
  if (props.status === "optimized") {
    indicators.push({
      label: "Cache active",
      icon: <CheckCircle2 className="h-3 w-3" />,
      style: "border-mint/20 text-mint/70 bg-mint/[0.04]",
    });
  } else if (props.status === "error") {
    indicators.push({
      label: "Error state",
      icon: <XCircle className="h-3 w-3" />,
      style: "border-red-500/20 text-red-400/70 bg-red-500/[0.04]",
    });
  }

  // Event limit warning
  const eventPct = props.maxMonthlyEvents > 0
    ? (props.monthlyEvents / props.maxMonthlyEvents) * 100
    : 0;
  if (eventPct >= 90) {
    indicators.push({
      label: "Events near limit",
      icon: <AlertTriangle className="h-3 w-3" />,
      style: "border-amber-500/20 text-amber-400/70 bg-amber-500/[0.04]",
    });
  }

  return indicators;
}

function formatAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
