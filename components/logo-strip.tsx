import { Check } from "lucide-react";
import { COMPATIBILITY, COMPATIBILITY_GROUPS } from "@/lib/content";

/**
 * Compatibility: what the connector detects and works with, grouped so a store owner can
 * find their own cache plugin, host, builder and currency tools at a glance.
 */
export function LogoStrip() {
  return (
    <section aria-labelledby="compatibility-heading" className="surface-paper border-y border-ink/10 bg-paper-2">
      <div className="container-page py-12 sm:py-14">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow text-ink/40">
              <span className="h-px w-6 bg-ink/25" />
              Compatibility
            </p>
            <h2 id="compatibility-heading" className="display-tight mt-3 text-[clamp(24px,2.7vw,32px)] text-ink">
              Runs on the stack you already have.
            </h2>
          </div>
          <p className="max-w-[440px] text-[14px] leading-relaxed text-ink/55 lg:pb-1 lg:text-right">
            Keep your cache plugin, host, CDN and page builder. Silo detects them, works alongside
            them and keeps every layer accurate when stock, prices or sales change. No DNS change,
            no theme rewrite.
          </p>
        </div>

        <p className="sr-only">Compatible with {COMPATIBILITY.join(", ")}.</p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {COMPATIBILITY_GROUPS.map((group) => (
            <div key={group.title} className="border border-ink/10 bg-white/60 p-4">
              <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{group.title}</h3>
              <p className="mt-1 text-[12.5px] leading-snug text-ink/50">{group.note}</p>
              <ul className="mt-3 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[13px] text-ink/75">
                    <Check className="h-3.5 w-3.5 shrink-0 text-mint-deep" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-ink/45">
          <span className="flex items-center gap-2">
            <span className="pulse-dot" />
            Another page cache active? Silo switches to work-alongside mode automatically.
          </span>
          <span className="hidden h-3 w-px bg-ink/10 sm:block" />
          <span>Product and archive pages only: cart, checkout and account are never cached.</span>
        </div>
      </div>
    </section>
  );
}
