import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/account/password-reset-forms";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-ink px-4">
      <ForgotPasswordForm />
    </div>
  );
}
