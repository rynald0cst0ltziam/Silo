import { COMPATIBILITY, COMPATIBILITY_GROUPS } from "@/lib/content";

/** One dot colour per group, so a scanning eye can tell a cache plugin from a builder. */
const GROUP_DOT: Record<string, string> = {
  Platform: "bg-woo",
  "Cache plugins": "bg-accent",
  "Hosts and CDN": "bg-mint-deep",
  "Page builders and themes": "bg-amber",
  "Languages and currencies": "bg-ink/45",
};

type Chip = { name: string; group: string };

function chips(groups: string[]): Chip[] {
  return COMPATIBILITY_GROUPS.filter((g) => groups.includes(g.title)).flatMap((g) => g.items.map((name) => ({ name, group: g.title })));
}

const ROW_ONE = chips(["Cache plugins", "Hosts and CDN"]);
const ROW_TWO = chips(["Page builders and themes", "Languages and currencies", "Platform"]);

function Row({ items, reverse = false }: { items: Chip[]; reverse?: boolean }) {
  return (
    <div className="marquee-mask relative overflow-hidden py-1.5">
      <div className={`${reverse ? "marquee-track-reverse" : "marquee-track"} flex w-max`} aria-hidden="true">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 items-center gap-2.5 pr-2.5">
            {items.map((item) => (
              <span
                key={`${copy}-${item.name}`}
                className="flex shrink-0 items-center gap-2 rounded-full border border-ink/[0.09] bg-white px-4 py-2 shadow-[0_1px_0_rgba(8,9,11,0.04)]"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${GROUP_DOT[item.group]}`} />
                <span className="whitespace-nowrap text-[13.5px] font-medium tracking-[-0.01em] text-ink/75">{item.name}</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Compatibility: two slow rows drifting in opposite directions, colour-coded by group.
 * Pauses on hover; static for visitors who prefer reduced motion.
 */
export function LogoStrip() {
  return (
    <section aria-labelledby="compatibility-heading" className="surface-paper border-y border-ink/10 bg-paper-2">
      <div className="container-page pt-12 sm:pt-14">
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
            Keep your cache plugin, host, CDN and page builder. Silo works alongside them and keeps
            every layer accurate when stock, prices or sales change.
          </p>
        </div>
      </div>

      <p className="sr-only">Compatible with {COMPATIBILITY.join(", ")}.</p>

      <div className="mt-8 space-y-1">
        <Row items={ROW_ONE} />
        <Row items={ROW_TWO} reverse />
      </div>

      <div className="container-page pb-12 pt-6 sm:pb-14">
        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink/50">
          {COMPATIBILITY_GROUPS.map((g) => (
            <li key={g.title} className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${GROUP_DOT[g.title]}`} />
              {g.title}
            </li>
          ))}
          <li className="text-ink/40 sm:ml-auto">Another page cache active? Silo switches to work-alongside mode automatically.</li>
        </ul>
      </div>
    </section>
  );
}
