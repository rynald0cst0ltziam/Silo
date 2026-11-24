import { NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { emailConfigured, sendEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { siteUrl } from "@/lib/utils";

/**
 * Email a one-hour, single-use reset link. The response is the same whether or not
 * the address has an account, so it cannot be used to discover accounts.
 */
export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.allowed) return rl.response!;

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: "Password reset by email is not switched on yet. Email rynaldostoltz85@gmail.com from your account address and we will reset it for you." },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } }) : null;

  if (user) {
    const recent = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 15 * 60_000) } },
    });
    if (recent < 3) {
      const token = randomBytes(32).toString("base64url");
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 60 * 60_000),
        },
      });
      const link = `${siteUrl().replace(/\/+$/, "")}/reset-password?token=${token}`;
      await sendEmail(
        user.email,
        "Reset your Silo password",
        `Someone asked to reset the password for your Silo account.\n\nReset it here (valid for one hour, works once):\n${link}\n\nIf this was not you, ignore this email. Your password stays the same.`,
        `<p>Someone asked to reset the password for your Silo account.</p><p><a href="${link}">Reset your password</a> (valid for one hour, works once).</p><p>If this was not you, ignore this email. Your password stays the same.</p>`,
      );
      await audit("account.password_reset_requested", { userId: user.id, req });
    }
  }

  return NextResponse.json({ ok: true });
}
