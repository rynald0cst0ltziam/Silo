import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({
  className,
  onDark = true,
}: {
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-6 w-6 shrink-0 grid-cols-2 gap-[2.5px] rounded-[6px] p-[3px]",
        onDark
          ? "bg-white/[0.06] ring-1 ring-white/10"
          : "bg-ink/[0.04] ring-1 ring-ink/10",
        className,
      )}
    >
      <span className={cn("rounded-[2px]", onDark ? "bg-paper" : "bg-ink")} />
      <span className="rounded-[2px] bg-accent" />
      <span className={cn("rounded-[2px]", onDark ? "bg-paper/35" : "bg-ink/25")} />
      <span className={cn("rounded-[2px]", onDark ? "bg-paper/35" : "bg-ink/25")} />
    </span>
  );
}

export function Logo({
  className,
  onDark = true,
  compact = false,
}: {
  className?: string;
  onDark?: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label="Silo — cache for WooCommerce, home"
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <LogoMark onDark={onDark} />
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-display text-[20px] font-semibold leading-none tracking-[-0.05em]",
            onDark ? "text-paper" : "text-ink",
          )}
        >
          silo
        </span>
        {!compact && (
          <span
            className={cn(
              "hidden border-l pl-2 text-[9px] font-medium uppercase tracking-[0.14em] sm:inline",
              onDark ? "border-white/15 text-paper/40" : "border-ink/15 text-ink/40",
            )}
          >
            for WooCommerce
          </span>
        )}
      </span>
    </Link>
  );
}
