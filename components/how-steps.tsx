import { Check, KeyRound, ScanLine, ShieldCheck } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: KeyRound,
    title: "Connect",
    body: "Install the connector and paste your store key. Silo reads your catalog, permalinks and Store API routes. No DNS change, no theme rewrite.",
    meta: "About 4 minutes",
    visual: "connect",
  },
  {
    number: "02",
    icon: ScanLine,
    title: "Scan",
    body: "The catalog becomes a graph: products to variations, variations to stock, products to categories, routes to filters. That graph is the invalidation plan.",
    meta: "Automatic, on first sync",
    visual: "scan",
  },
  {
    number: "03",
    icon: ShieldCheck,
    title: "Always accurate",
    body: "WooCommerce events hit the connector. Silo walks the graph, invalidates the exact nodes, re-warms priority pages and logs the entire decision.",
    meta: "42ms median event",
    visual: "accurate",
  },
] as const;

export function HowSteps() {
  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[340px] w-[620px] -translate-x-1/2 rounded-full bg-accent/8 blur-[120px]" />
      <div className="container-page section relative">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <p className="eyebrow text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              How it works
            </p>
            <h2 className="display-tight mt-5 max-w-[640px] text-[clamp(28px,3.6vw,44px)] text-paper">
              Connect. Scan. Always accurate.
            </h2>
          </div>
          <p className="lede max-w-[400px]">
            The install is boring on purpose. The intelligence is in the graph, not in a settings
            screen you have to maintain.
          </p>
        </div>

        <div className="relative mt-14 grid gap-4 md:grid-cols-3">
          <div className="pointer-events-none absolute left-[10%] right-[10%] top-[52px] hidden h-px bg-gradient-to-r from-transparent via-white/12 to-transparent md:block" />
          {STEPS.map((step) => (
            <article
              key={step.number}
              className="relative rounded-2xl border border-white/8 bg-[#0b0d11]/80 p-5 backdrop-blur-sm sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-accent/25 bg-accent/10">
                  <step.icon className="h-4 w-4 text-accent-hi" />
                </span>
                <span className="font-mono text-[10px] tracking-[0.12em] text-paper/25">
                  {step.number}
                </span>
              </div>

              <StepVisual kind={step.visual} />

              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.025em] text-paper">
                {step.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.65] text-paper/50">{step.body}</p>
              <p className="mt-5 flex items-center gap-2 border-t border-white/8 pt-3 font-mono text-[9.5px] uppercase tracking-[0.06em] text-paper/30">
                <Check className="h-3 w-3 text-mint/70" />
                {step.meta}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepVisual({ kind }: { kind: (typeof STEPS)[number]["visual"] }) {
  if (kind === "connect") {
    return (
      <div className="mt-5 rounded-lg border border-white/8 bg-[#080a0d] p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[9px] text-paper/60">
            <span className="h-1.5 w-1.5 rounded-sm bg-woo" />
            Silo Connector
          </span>
          <span className="rounded bg-mint/10 px-1.5 py-0.5 font-mono text-[7px] text-mint">
            ACTIVE
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 rounded border border-white/9 bg-white/[0.02] px-2 py-1.5">
          <KeyRound className="h-2.5 w-2.5 text-paper/30" />
          <span className="font-mono text-[8px] tracking-[0.18em] text-paper/35">
            sk_silo_••••••••••••
          </span>
        </div>
        <p className="mt-2 font-mono text-[7px] text-paper/25">
          store key scoped to one install
        </p>
      </div>
    );
  }

  if (kind === "scan") {
    return (
      <div className="mt-5 rounded-lg border border-white/8 bg-[#080a0d] p-3">
        <div className="flex items-center justify-between font-mono text-[7px] uppercase tracking-[0.1em] text-paper/30">
          <span>catalog graph</span>
          <span className="text-accent-hi">syncing</span>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          {Array.from({ length: 24 }).map((_, index) => (
            <span
              key={index}
              className={
                index % 7 === 0
                  ? "h-2 w-2 rounded-[2px] bg-accent/80"
                  : index % 5 === 0
                    ? "h-2 w-2 rounded-[2px] bg-mint/50"
                    : "h-2 w-2 rounded-[2px] bg-white/12"
              }
            />
          ))}
        </div>
        <div className="mt-2.5 flex items-center justify-between font-mono text-[7px] text-paper/30">
          <span>4,218 products</span>
          <span>11,904 variations</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-white/8 bg-[#080a0d] p-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[8px] text-paper/55">stock.changed</span>
        <span className="font-mono text-[7.5px] text-mint">42ms</span>
      </div>
      <div className="mt-2 space-y-1">
        {[
          ["graph walk", "done"],
          ["invalidate 3 URLs", "done"],
          ["warm 2 priority", "queued"],
        ].map(([label, state], index) => (
          <div key={label} className="flex items-center justify-between font-mono text-[7px]">
            <span className="flex items-center gap-1.5 text-paper/35">
              <span
                className={
                  index === 2
                    ? "h-1 w-1 rounded-full bg-amber"
                    : "h-1 w-1 rounded-full bg-mint"
                }
              />
              {label}
            </span>
            <span className={index === 2 ? "text-amber/70" : "text-mint/60"}>{state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
