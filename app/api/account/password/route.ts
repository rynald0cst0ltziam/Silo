import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

/** Change password. Every session is signed out; the caller signs in again with the new one. */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { current?: unknown; next?: unknown } | null;
  const current = typeof body?.current === "string" ? body.current : "";
  const next = typeof body?.next === "string" ? body.next : "";

  if (!(await bcrypt.compare(current, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
  }
  if (next.length < 8 || next.length > 200) {
    return NextResponse.json({ error: "New password must be 8 to 200 characters" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(next, 12), sessionVersion: { increment: 1 } },
  });
  await audit("account.password", { userId: user.id, req });
  return NextResponse.json({ ok: true, reauth: true });
}
