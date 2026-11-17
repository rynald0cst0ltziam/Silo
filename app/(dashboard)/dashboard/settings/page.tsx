import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");

  return (
    <div>
      <h1 className="text-[22px] font-semibold tracking-tight text-paper">
        Settings
      </h1>
      <p className="mt-1 text-[12px] text-paper/40">
        Account and notification preferences.
      </p>

      <div className="mt-6 rounded-xl border border-white/8 bg-[#0b0d11] p-5">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-white/6 pb-4">
            <div>
              <p className="text-[12px] font-medium text-paper/70">Email</p>
              <p className="mt-0.5 font-mono text-[10px] text-paper/35">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] font-medium text-paper/70">Account ID</p>
              <p className="mt-0.5 font-mono text-[9px] text-paper/25">
                {user.id}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
