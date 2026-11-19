"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flame,
  LayoutDashboard,
  Package,
  Settings2,
  Zap,
} from "lucide-react";

const ICONS = {
  overview: LayoutDashboard,
  catalog: Package,
  invalidations: Zap,
  warmup: Flame,
  settings: Settings2,
} as const;

export function StoreNavLink({
  href,
  icon,
  label,
  exact,
  badge,
}: {
  href: string;
  icon: keyof typeof ICONS;
  label: string;
  exact?: boolean;
  badge?: number;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[15px] font-medium transition ${
        active
          ? "bg-accent/10 text-accent"
          : "text-paper/40 hover:bg-white/[0.03] hover:text-paper/60"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-auto rounded bg-amber/15 px-1 font-mono text-[11px] text-amber">
          {badge}
        </span>
      )}
    </Link>
  );
}
