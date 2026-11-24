import { NextResponse } from "next/server";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

/** Set a new password with an emailed token. Signs out every existing session. */
export async function POST(req: Request) {
  const rl = rateLimit(req);
  if (!rl.allowed) return rl.response!;

  const body = (await req.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json({ error: "Password must be 8 to 200 characters" }, { status: 400 });
  }

  const record = token
    ? await prisma.passwordResetToken.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } })
    : null;
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link has expired or was already used. Request a new one." }, { status: 400 });
  }

  // Claim the token first so two concurrent submissions cannot both use it.
  const claimed = await prisma.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "This reset link was already used. Request a new one." }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await bcrypt.hash(password, 12), sessionVersion: { increment: 1 } },
  });
  await audit("account.password_reset", { userId: record.userId, req });
  return NextResponse.json({ ok: true });
}
