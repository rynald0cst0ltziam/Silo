import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/account/password-reset-forms";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-ink px-4">
      <ResetPasswordForm token={typeof token === "string" ? token : ""} />
    </div>
  );
}
