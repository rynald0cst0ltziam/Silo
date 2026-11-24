import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/admin";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Silo admin" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="min-h-screen bg-[#07080a]">
      <AdminNav />
      <div className="container-page py-6 sm:py-8">{children}</div>
    </div>
  );
}
