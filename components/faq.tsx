import { Plus } from "lucide-react";
import { PRICING_FAQS, type Faq } from "@/lib/content";

export function FaqList({ items = PRICING_FAQS }: { items?: Faq[] }) {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((item, index) => (
        <details key={item.q} className="group">
          <summary className="flex items-start justify-between gap-6 py-5 text-left sm:py-6">
            <span className="flex items-start gap-4">
              <span className="mt-1 font-mono text-[9px] tracking-[0.08em] text-ink/25">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-[14.5px] font-medium tracking-[-0.01em] text-ink">
                {item.q}
              </span>
            </span>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink/12 text-ink/40 transition-transform duration-200 group-open:rotate-45 group-open:border-accent/30 group-open:text-accent-deep">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </summary>
          <div className="pb-6 pl-[38px] pr-10">
            <p className="max-w-[720px] text-[13.5px] leading-[1.7] text-ink/55">{item.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
