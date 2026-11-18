"use client";

import {
  Clock,
  Shield,
  Zap,
  Eye,
  Link2,
  Filter,
} from "lucide-react";

interface SiloConfig {
  version: number;
  tier: string;
  limits: {
    warmup_urls_per_event: number;
    max_monthly_events: number;
  };
  variants: {
    device: boolean;
    language: string[];
    currency: boolean;
    geo_tax: boolean;
    attribute_filters: boolean;
    pagination: boolean;
  };
  exclusions: string[];
  ttl: {
    product: number;
    category: number;
    shop: number;
    store_api: number;
  };
  priority_products: number[];
  priority_urls: string[];
  invalidation_rules: {
    on_product_update: string[];
    on_stock_change: string[];
    on_order: string[];
  };
  store_api: {
    enabled: boolean;
    endpoints: string[];
    vary: string[];
  };
  hooks_required: string[];
}

function formatSeconds(s: number): string {
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`;
  if (s >= 60) return `${Math.round(s / 60)}m`;
  return `${s}s`;
}

export function StoreConfigDetails({ config }: { config: SiloConfig | null }) {
  if (!config) {
    return (
      <p className="text-[11px] text-paper/30">
        No config generated yet. Connect to Silo to receive your optimized configuration.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* TTL */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Clock className="h-3.5 w-3.5" />
          Cache TTL
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(config.ttl).map(([key, val]) => (
            <div
              key={key}
              className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
            >
              <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
                {key.replace(/_/g, " ")}
              </p>
              <p className="mt-1 font-mono text-[14px] text-paper/70">
                {formatSeconds(val)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Cache variants */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Eye className="h-3.5 w-3.5" />
          Cache variants
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {config.variants.device && (
            <VariantTag label="Device (mobile/desktop)" active />
          )}
          {config.variants.currency && (
            <VariantTag label="Multi-currency" active />
          )}
          {config.variants.language.length > 1 && (
            <VariantTag
              label={`Languages: ${config.variants.language.join(", ")}`}
              active
            />
          )}
          {config.variants.geo_tax && (
            <VariantTag label="Geo-based tax" active />
          )}
          {config.variants.attribute_filters && (
            <VariantTag label="Attribute filters" active />
          )}
          {config.variants.pagination && (
            <VariantTag label="Pagination" active />
          )}
        </div>
      </div>

      {/* Invalidation rules */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Zap className="h-3.5 w-3.5" />
          Invalidation rules
        </div>
        <div className="mt-2 space-y-2">
          {Object.entries(config.invalidation_rules).map(([trigger, targets]) => (
            <div
              key={trigger}
              className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
            >
              <p className="font-mono text-[9px] font-medium text-accent/60">
                {trigger.replace(/_/g, " ")}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {(targets as string[]).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[8px] text-paper/40"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exclusions */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Filter className="h-3.5 w-3.5" />
          Cache exclusions
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {config.exclusions.map((ex) => (
            <span
              key={ex}
              className="rounded border border-white/6 bg-white/[0.02] px-2 py-1 font-mono text-[9px] text-paper/40"
            >
              {ex}
            </span>
          ))}
        </div>
      </div>

      {/* Store API */}
      {config.store_api.enabled && (
        <div>
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
            <Link2 className="h-3.5 w-3.5" />
            Store API caching
          </div>
          <div className="mt-2 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
            <div className="flex flex-wrap gap-2">
              {config.store_api.endpoints.map((ep) => (
                <span
                  key={ep}
                  className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[8px] text-paper/40"
                >
                  {ep}
                </span>
              ))}
            </div>
            {config.store_api.vary.length > 0 && (
              <p className="mt-1.5 font-mono text-[8px] text-paper/25">
                Vary: {config.store_api.vary.join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Limits */}
      <div>
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-paper/40">
          <Shield className="h-3.5 w-3.5" />
          Tier limits
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
            <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
              Warmup URLs / event
            </p>
            <p className="mt-1 font-mono text-[14px] text-paper/70">
              {config.limits.warmup_urls_per_event}
            </p>
          </div>
          <div className="rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2">
            <p className="font-mono text-[8px] uppercase tracking-wider text-paper/25">
              Max monthly events
            </p>
            <p className="mt-1 font-mono text-[14px] text-paper/70">
              {config.limits.max_monthly_events.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function VariantTag({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[8px] font-medium ${
        active
          ? "border-accent/20 bg-accent/[0.04] text-accent/70"
          : "border-white/8 bg-white/[0.02] text-paper/30"
      }`}
    >
      {label}
    </span>
  );
}
