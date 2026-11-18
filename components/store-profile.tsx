"use client";

import {
  Package,
  Layers,
  BarChart3,
  Globe,
  DollarSign,
  Database,
  ShieldCheck,
} from "lucide-react";

interface StoreProfile {
  url: string;
  product_count: number;
  product_types: Record<string, number>;
  variation_complexity: "high" | "low";
  stock_management: boolean;
  hpos: boolean;
  multilingual: string[];
  multi_currency: boolean;
}

export function StoreProfilePanel({ profile }: { profile: StoreProfile | null }) {
  if (!profile) {
    return (
      <p className="text-[11px] text-paper/30">
        No scan data. Connect the plugin to scan your store.
      </p>
    );
  }

  const types = profile.product_types ?? {};
  const totalProducts = profile.product_count ?? Object.values(types).reduce((a, b) => a + b, 0);
  const languages = profile.multilingual ?? [];

  return (
    <div className="space-y-5">
      {/* Product overview */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Package className="h-3.5 w-3.5" />
          Catalog
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile
            label="Total products"
            value={totalProducts.toLocaleString()}
          />
          {Object.entries(types).map(([type, count]) => (
            <StatTile
              key={type}
              label={type}
              value={String(count)}
            />
          ))}
        </div>
      </div>

      {/* Capabilities detected */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <BarChart3 className="h-3.5 w-3.5" />
          Detected capabilities
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CapBadge
            icon={<Layers className="h-3 w-3" />}
            label={`Variation complexity: ${profile.variation_complexity}`}
            active={profile.variation_complexity === "high"}
          />
          <CapBadge
            icon={<Database className="h-3 w-3" />}
            label={`Stock management: ${profile.stock_management ? "on" : "off"}`}
            active={profile.stock_management}
          />
          <CapBadge
            icon={<ShieldCheck className="h-3 w-3" />}
            label={`HPOS: ${profile.hpos ? "enabled" : "disabled"}`}
            active={profile.hpos}
          />
          <CapBadge
            icon={<Globe className="h-3 w-3" />}
            label={
              languages.length > 1
                ? `Multilingual: ${languages.join(", ")}`
                : "Single language"
            }
            active={languages.length > 1}
          />
          <CapBadge
            icon={<DollarSign className="h-3 w-3" />}
            label={`Multi-currency: ${profile.multi_currency ? "on" : "off"}`}
            active={profile.multi_currency}
          />
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2.5">
      <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
        {label}
      </p>
      <p className="mt-1 font-mono text-[16px] font-semibold text-paper/70">
        {value}
      </p>
    </div>
  );
}

function CapBadge({
  icon,
  label,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-medium ${
        active
          ? "border-mint/20 bg-mint/[0.04] text-mint/70"
          : "border-white/8 bg-white/[0.02] text-paper/35"
      }`}
    >
      {icon}
      {label}
    </div>
  );
}
