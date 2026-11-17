import { Check } from "lucide-react";
import { COMPATIBILITY } from "@/lib/content";

const GLYPHS: Record<string, string> = {
  "WooCommerce 8.2+": "Woo",
  "WordPress 6.4+": "WP",
  HPOS: "HP",
  "Product Blocks": "Bl",
  "Store API": "API",
  "PHP 8.1+": "php",
};

export function LogoStrip() {
  return (
    <section
      aria-labelledby="compatibility-heading"
      className="surface-paper border-y border-ink/10 bg-paper-2"
    >
      <div className="container-page py-9 sm:py-11">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-ink/35">
              <span className="h-px w-6 bg-ink/25" />
              Compatibility
            </p>
            <h2
              id="compatibility-heading"
              className="display-tight mt-3 text-[clamp(23px,2.6vw,30px)] text-ink"
            >
              Runs on the stack you already have.
            </h2>
          </div>
          <p className="max-w-[360px] text-[12.5px] leading-relaxed text-ink/45 lg:pb-1 lg:text-right">
            No theme rewrite. No DNS change. One connector, installed in about four minutes.
          </p>
        </div>

        <p className="sr-only">
          Compatible with {COMPATIBILITY.join(", ")}.
        </p>
        <div className="marquee-mask relative mt-7 overflow-hidden border-y border-ink/10 py-4">
          <div className="marquee-track flex w-max" aria-hidden="true">
            {[0, 1].map((group) => (
              <div key={group} className="flex shrink-0 items-center gap-2.5 pr-2.5">
                {COMPATIBILITY.map((item) => (
                  <span
                    key={item}
                    className="flex shrink-0 items-center gap-2.5 rounded-full border border-ink/10 bg-white/70 py-2 pl-2 pr-3.5"
                  >
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-ink/[0.055] px-1 font-mono text-[7.5px] font-medium uppercase tracking-[0.04em] text-ink/55">
                      {GLYPHS[item]}
                    </span>
                    <span className="text-[12px] font-medium tracking-[-0.012em] text-ink/65">
                      {item}
                    </span>
                    <Check className="h-3 w-3 text-mint-deep" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10.5px] text-ink/35">
          <span className="flex items-center gap-2">
            <span className="pulse-dot" />
            Verified against current WooCommerce releases
          </span>
          <span className="hidden h-3 w-px bg-ink/10 sm:block" />
          <span>HPOS and legacy postmeta supported</span>
        </div>
      </div>
    </section>
  );
}
