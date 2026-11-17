import { ArrowRight, ArrowUpRight, LockKeyhole, ShieldCheck, Zap } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

const PRODUCTS = [
  {
    name: "Aster Linen Shirt",
    sku: "SKU-1042",
    variant: "Olive / M",
    price: "€129",
    stock: "Sold out",
    stockTone: "out",
    cache: "WARMING",
    changed: true,
    swatch:
      "radial-gradient(circle at 30% 22%, #84936f 0%, #546247 46%, #2b3327 100%)",
  },
  {
    name: "Coast Runner",
    sku: "SKU-2088",
    variant: "Sand / 42",
    price: "€149",
    stock: "12 in stock",
    stockTone: "in",
    cache: "HIT",
    changed: false,
    swatch:
      "radial-gradient(circle at 32% 24%, #ddc8a5 0%, #a58b66 48%, #5e4b35 100%)",
  },
  {
    name: "Field Tote",
    sku: "SKU-3310",
    variant: "Natural",
    price: "€89",
    stock: "18 in stock",
    stockTone: "in",
    cache: "HIT",
    changed: false,
    swatch:
      "radial-gradient(circle at 30% 22%, #e8dfcd 0%, #bbac92 48%, #80745f 100%)",
  },
] as const;

export function HeroPanel() {
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="pointer-events-none absolute -inset-12 -z-10 rounded-full bg-[radial-gradient(ellipse_at_58%_35%,rgba(61,107,255,0.26),transparent_62%)] blur-2xl" />
      <div className="pointer-events-none absolute inset-x-10 -bottom-6 -z-10 h-20 rounded-full bg-black/55 blur-2xl" />

      <div className="relative rounded-2xl border border-white/10 bg-[#0d1014]/95 p-2 shadow-[0_36px_90px_-30px_rgba(0,0,0,0.95)] backdrop-blur">
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0a0c10]">
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="h-5 w-5 rounded-[5px] p-[3px]" />
              <div className="min-w-0">
                <p className="truncate text-[10.5px] font-medium text-paper/80">
                  Aurora Supply Co.
                </p>
                <p className="font-mono text-[8px] tracking-wide text-paper/30">
                  cache map / v42
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1.5 rounded border border-mint/20 bg-mint/8 px-1.5 py-1 font-mono text-[7.5px] uppercase tracking-[0.06em] text-mint/90">
              <span className="pulse-dot h-1 w-1" />
              Connector online
            </span>
          </div>

          <div className="p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-paper/30">
                  Catalog / Cache
                </p>
                <p className="mt-0.5 text-[12px] font-medium text-paper/85">Summer linen</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[7.5px] text-mint/75">
                  1,279 warm
                </span>
                <span className="font-mono text-[7px] text-paper/25">5 purged · just now</span>
              </div>
            </div>

            <div className="mt-2.5 overflow-hidden rounded-lg border border-white/8">
              {PRODUCTS.map((product, index) => (
                <div
                  key={product.name}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto] items-center gap-2.5 px-2.5 py-2",
                    index < PRODUCTS.length - 1 && "border-b border-white/6",
                    product.changed && "bg-accent/[0.04]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/15"
                    style={{ backgroundImage: product.swatch }}
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.2),transparent_55%)]" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[10.5px] font-medium text-paper/85">
                        {product.name}
                      </p>
                      {product.changed && (
                        <span className="h-1 w-1 shrink-0 rounded-full bg-accent-hi" />
                      )}
                    </div>
                    <p className="truncate font-mono text-[7.5px] text-paper/30">
                      {product.sku} · {product.variant} · {product.price}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={cn(
                        "rounded border px-1 py-[1px] font-mono text-[7px] tracking-[0.04em]",
                        product.cache === "HIT"
                          ? "border-mint/20 bg-mint/8 text-mint/80"
                          : "border-accent/25 bg-accent/10 text-accent-hi",
                      )}
                    >
                      {product.cache}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[7.5px]",
                        product.stockTone === "out" ? "text-rose/80" : "text-paper/40",
                      )}
                    >
                      {product.stock}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2.5 rounded-lg border border-white/9 bg-[#0c0f13] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/12 ring-1 ring-accent/20">
                    <Zap className="h-2.5 w-2.5 text-accent-hi" />
                  </span>
                  <span className="truncate font-mono text-[9px] text-paper/75">
                    stock.changed
                  </span>
                  <span className="hidden truncate font-mono text-[8px] text-paper/25 sm:inline">
                    SKU-1042-OLV-M
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[9px] text-mint">42 ms</span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {["product", "2 archives", "1 Store API route"].map((node, index) => (
                  <div key={node} className="flex items-center gap-1.5">
                    {index > 0 && <ArrowRight className="h-2.5 w-2.5 text-paper/15" />}
                    <span className="rounded border border-white/9 bg-white/[0.02] px-1.5 py-0.5 font-mono text-[7.5px] text-paper/45">
                      {node}
                    </span>
                  </div>
                ))}
                <span className="ml-auto rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[7.5px] text-mint/70">
                  purged
                </span>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/8 pt-2 font-mono text-[8px]">
                <span className="text-paper/30">2 priority pages re-warming</span>
                <span className="hidden items-center gap-1 text-paper/45 sm:flex">
                  1,279 nodes untouched
                  <ArrowUpRight className="h-2.5 w-2.5" />
                </span>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/9 bg-[#0c0f13] p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-paper/30">
                    Product TTFB
                  </span>
                  <span className="rounded bg-mint/10 px-1 py-0.5 font-mono text-[6.5px] text-mint">
                    -68%
                  </span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <p className="font-display text-[17px] leading-none tracking-[-0.04em] text-paper">
                    38<span className="ml-0.5 text-[8px] text-paper/40">ms</span>
                  </p>
                  <svg viewBox="0 0 100 26" className="h-4 w-16 shrink-0" aria-hidden="true">
                    <path
                      d="M0 22 L12 20 L24 21 L36 15 L48 17 L60 10 L72 12 L84 7 L100 5"
                      fill="none"
                      stroke="#3d6bff"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <p className="mt-1 font-mono text-[6.5px] text-paper/25">p95 · origin 118 ms</p>
              </div>

              <div className="rounded-lg border border-white/9 bg-[#0c0f13] p-2.5">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-2.5 w-2.5 text-mint" />
                  <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-paper/30">
                    Session boundary
                  </span>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <p className="font-display text-[17px] leading-none tracking-[-0.04em] text-paper">
                    0<span className="ml-1 text-[8px] text-paper/40">shared</span>
                  </p>
                  <LockKeyhole className="h-3.5 w-3.5 text-mint/60" />
                </div>
                <p className="mt-1 font-mono text-[6.5px] text-paper/25">
                  cart · checkout · account
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
