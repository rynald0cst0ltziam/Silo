"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CreditCard, LayoutGrid, Plus, Settings, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Stores", icon: LayoutGrid, exact: false },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard, exact: true },
  { href: "/dashboard/activity", label: "Activity", icon: Activity, exact: true },
  { href: "/dashboard/settings", label: "Account", icon: Settings, exact: true },
];

const ADMIN_ITEM = { href: "/admin", label: "Admin", icon: ShieldCheck, exact: false };

/**
 * Secondary navigation for signed-in users, below the main site header.
 */
export function DashboardNav({ admin = false }: { admin?: boolean }) {
  const pathname = usePathname();
  const items = admin ? [...ITEMS, ADMIN_ITEM] : ITEMS;
  return (
    <div className="border-b border-white/8 bg-[#090b0e]">
      <div className="container-page flex h-12 items-center justify-between gap-4">
        <nav aria-label="Dashboard" className="flex items-center gap-1 overflow-x-auto">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : item.href === "/admin"
                ? pathname.startsWith("/admin")
                : pathname === "/dashboard" || pathname.startsWith("/dashboard/stores") || pathname.startsWith("/dashboard/connect");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-[14px] font-medium transition",
                  active ? "bg-white/[0.06] text-paper" : "text-paper/55 hover:bg-white/[0.04] hover:text-paper",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/dashboard/connect"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[14px] font-medium text-white transition hover:bg-accent-hi"
        >
          <Plus className="h-3.5 w-3.5" />
          Add store
        </Link>
      </div>
    </div>
  );
}
