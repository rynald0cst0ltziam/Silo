import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The live dot: Silo's status light. Breathes softly (static with reduced motion).
 */
export function LiveDot({ onDark = true, className }: { onDark?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("live-dot", onDark ? "bg-mint text-mint" : "bg-mint-deep text-mint-deep", className)}
    />
  );
}

/**
 * Compact square mark for tight spots (favicon, hero panel, tables): an "s" with the live dot.
 */
export function LogoMark({ className, onDark = true }: { className?: string; onDark?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] font-display text-[14px] font-bold leading-none tracking-[-0.05em]",
        onDark ? "bg-white/[0.07] text-paper ring-1 ring-white/10" : "bg-ink text-paper",
        className,
      )}
    >
      <span className="-mt-px">s</span>
      <span className="absolute right-[18%] top-[18%] h-[22%] w-[22%] rounded-full bg-mint" />
    </span>
  );
}

/**
 * Wordmark: "silo" followed by the live dot.
 */
export function Logo({
  className,
  onDark = true,
  size = 21,
}: {
  className?: string;
  onDark?: boolean;
  /** Kept for older call sites; the descriptor tag is no longer shown. */
  compact?: boolean;
  size?: number;
}) {
  return (
    <Link href="/" aria-label="Silo, cache for WooCommerce. Home" className={cn("group inline-flex items-center", className)}>
      <span
        className={cn("inline-flex items-start font-display font-semibold leading-none tracking-[-0.055em]", onDark ? "text-paper" : "text-ink")}
        style={{ fontSize: size }}
      >
        silo
        <LiveDot onDark={onDark} className="ml-[0.07em] mt-[0.02em]" />
      </span>
    </Link>
  );
}
