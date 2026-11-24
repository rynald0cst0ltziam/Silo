import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeleteAccount, PasswordForm, ProfileForm, SignOutEverywhere } from "@/components/account/account-forms";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

function Section({ title, intro, children, danger = false }: { title: string; intro: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`border bg-[#0b0d11] p-5 sm:p-6 ${danger ? "border-red-500/25" : "border-white/8"}`}>
      <h2 className={`text-[17px] font-semibold ${danger ? "text-red-300" : "text-paper"}`}>{title}</h2>
      <p className="mt-1 text-[14px] text-paper/50">{intro}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const storeCount = await prisma.store.count({ where: { userId: user.id } });
  const hasSubscription = !!user.subscription && !["canceled", "incomplete_expired"].includes(user.subscription.status);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-paper">Account</h1>
        <p className="mt-1 text-[15px] text-paper/50">
          Member since {user.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · Account ID{" "}
          <span className="font-mono text-[13px] text-paper/40">{user.id}</span>
        </p>
      </div>

      <Section title="Profile" intro="Your name and the email you sign in with. Invoices go to this address.">
        <ProfileForm name={user.name ?? ""} email={user.email} />
      </Section>

      <Section title="Password" intro="Changing it signs you out of every browser.">
        <PasswordForm />
      </Section>

      <Section
        title="Sessions"
        intro={user.lastLoginAt ? `Last sign-in ${user.lastLoginAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Lost a laptop or shared a login? End every session now.` : "End every signed-in session, including this one."}
      >
        <SignOutEverywhere />
      </Section>

      <Section title="Delete account" intro="Removes the account, all stores and their history." danger>
        <DeleteAccount storeCount={storeCount} hasSubscription={hasSubscription} />
      </Section>
    </div>
  );
}
