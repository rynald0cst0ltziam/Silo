import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { getAccess } from "@/lib/entitlements";
import { DashboardNav } from "@/components/dashboard-nav";
import { AccessBanner } from "@/components/account/access-banner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  const access = getAccess(user);
  const [storeCount, usage] = await Promise.all([
    prisma.store.count({ where: { userId: user.id } }),
    prisma.store.aggregate({ where: { userId: user.id }, _sum: { monthlyEvents: true } }),
  ]);
  const pausedStores = access.active ? Math.max(0, storeCount - access.tier.maxStores) : 0;

  return (
    <div className="min-h-screen bg-[#07080a]">
      <DashboardNav admin={isAdmin(user)} />
      <AccessBanner access={access} pausedStores={pausedStores} eventsUsed={usage._sum.monthlyEvents ?? 0} />
      <div className="container-page py-6 sm:py-8">{children}</div>
    </div>
  );
}
