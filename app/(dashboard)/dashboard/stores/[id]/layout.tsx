import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Flame,
  LayoutDashboard,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StoreNavLink } from "@/components/store-nav-link";

export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const store = await prisma.store.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true,
      name: true,
      url: true,
      status: true,
      apiKeyHash: true,
      lastSeenAt: true,
      configVersion: true,
    },
  });

  if (!store) notFound();

  const basePath = `/dashboard/stores/${id}`;
  const isOnline =
    store.lastSeenAt &&
    Date.now() - new Date(store.lastSeenAt).getTime() < 15 * 60 * 1000;

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1 text-[11px] text-paper/30 transition hover:text-paper/60"
      >
        <ArrowLeft className="h-3 w-3" />
        All stores
      </Link>

      <div className="flex gap-0">
        {/* Sidebar */}
        <aside className="hidden w-[200px] shrink-0 flex-col border-r border-white/8 pr-4 md:flex">
          {/* Store header */}
          <div className="mb-5">
            <div className="flex items-center gap-2">
              <h1 className="text-[15px] font-semibold tracking-tight text-paper">
                {store.name}
              </h1>
              {isOnline && (
                <span className="inline-flex items-center gap-1 rounded border border-mint/20 bg-mint/8 px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.06em] text-mint/80">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
                  Live
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-[9px] text-paper/30 truncate">
              {store.url}
            </p>
          </div>

          {/* Nav */}
          <nav className="space-y-0.5">
            <StoreNavLink href={basePath} icon="overview" label="Overview" exact />
            <StoreNavLink href={`${basePath}/catalog`} icon="catalog" label="Catalog" />
            <StoreNavLink href={`${basePath}/invalidations`} icon="invalidations" label="Invalidations" />
            <StoreNavLink href={`${basePath}/warmup`} icon="warmup" label="Warmup" />
            <StoreNavLink href={`${basePath}/settings`} icon="settings" label="Settings" />
          </nav>

          {/* Store key */}
          <div className="mt-auto pt-6">
            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-paper/25">
                  Store key
                </span>
                <ShieldCheck className="h-3 w-3 text-mint/60" />
              </div>
              <p className="mt-1.5 font-mono text-[8px] tracking-wide text-paper/40">
                sk_silo_...{store.apiKeyHash.slice(-6)}
              </p>
              <p className="mt-1 font-mono text-[7px] text-paper/20">
                config v{store.configVersion}
              </p>
            </div>
          </div>
        </aside>

        {/* Mobile nav */}
        <div className="mb-4 flex gap-1 overflow-x-auto md:hidden">
          <MobileTab href={basePath} label="Overview" />
          <MobileTab href={`${basePath}/catalog`} label="Catalog" />
          <MobileTab href={`${basePath}/invalidations`} label="Invalidations" />
          <MobileTab href={`${basePath}/warmup`} label="Warmup" />
          <MobileTab href={`${basePath}/settings`} label="Settings" />
        </div>

        {/* Main content */}
        <div className="min-w-0 flex-1 md:pl-6">{children}</div>
      </div>
    </div>
  );
}

function MobileTab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="shrink-0 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-[10px] font-medium text-paper/50 transition hover:bg-white/[0.05] hover:text-paper/70"
    >
      {label}
    </Link>
  );
}
