import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-[#07080a]">
      <header className="border-b border-white/8">
        <div className="container-page flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo className="h-5 w-auto" />
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-paper/50 transition hover:bg-white/5 hover:text-paper/80"
              >
                Stores
              </Link>
              <Link
                href="/dashboard/billing"
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-paper/50 transition hover:bg-white/5 hover:text-paper/80"
              >
                Billing
              </Link>
              <Link
                href="/dashboard/settings"
                className="rounded-md px-3 py-1.5 text-[11px] font-medium text-paper/50 transition hover:bg-white/5 hover:text-paper/80"
              >
                Settings
              </Link>
            </nav>
          </div>
          <UserMenu email={session.user.email!} name={session.user.name} />
        </div>
      </header>
      <div className="container-page py-6 sm:py-8">{children}</div>
    </div>
  );
}
