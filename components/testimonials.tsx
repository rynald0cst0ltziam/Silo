import { Quote } from "lucide-react";
import { TESTIMONIALS } from "@/lib/content";

export function Testimonials() {
  return (
    <section className="relative overflow-hidden border-y border-white/8 bg-[#0a0c10]">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-20 [mask-image:linear-gradient(to_bottom,transparent,black,transparent)]" />
      <div className="container-page section relative">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div>
            <p className="eyebrow text-accent-hi">
              <span className="h-px w-6 bg-accent-hi" />
              Early access
            </p>
            <h2 className="display-tight mt-5 max-w-[680px] text-[clamp(28px,3.6vw,44px)] text-paper">
              Operators don&apos;t need another dashboard.
              <span className="text-paper/35"> They need the stock to be right.</span>
            </h2>
          </div>
          <p className="lede max-w-[390px] lg:justify-self-end">
            Notes from catalog teams running Silo in preview — the first stores to trade full
            purges for a graph they can inspect.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <figure
              key={testimonial.name}
              className="flex flex-col rounded-2xl border border-white/9 bg-white/[0.025] p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <Quote className="h-4 w-4 text-accent-hi/60" />
                <span className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-paper/20">
                  Note 0{index + 1}
                </span>
              </div>
              <blockquote className="mt-5 flex-1 text-[13.5px] leading-[1.65] text-paper/65">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-white/8 pt-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] font-mono text-[9px] text-paper/50">
                  {testimonial.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")}
                </span>
                <div>
                  <p className="text-[11.5px] font-medium text-paper/80">{testimonial.name}</p>
                  <p className="mt-0.5 font-mono text-[8.5px] text-paper/30">
                    {testimonial.role} · {testimonial.context}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
