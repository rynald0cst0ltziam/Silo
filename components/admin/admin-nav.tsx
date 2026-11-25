"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/visitors", label: "Visitors" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/stores", label: "Stores" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/audit", label: "Audit log" },
  { href: "/admin/system", label: "System" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-white/8 bg-[#0a0b0f]">
      <div className="container-page flex h-12 items-center gap-4">
        <span className="shrink-0 border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-amber">Admin</span>
        <nav aria-label="Admin" className="flex items-center gap-1 overflow-x-auto">
          {ITEMS.map((item) => {
            const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 text-[14px] font-medium transition",
                  active ? "bg-white/[0.07] text-paper" : "text-paper/55 hover:bg-white/[0.04] hover:text-paper",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link href="/dashboard" className="ml-auto shrink-0 text-[14px] text-paper/55 hover:text-paper">
          Back to my dashboard
        </Link>
      </div>
    </div>
  );
}
