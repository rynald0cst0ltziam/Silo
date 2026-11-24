import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { authConfig } from "./auth.config";

const failures = new Map<string, { count: number; until: number }>();
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60_000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 200) return null;

        // Brute-force brake per address (per instance).
        const now = Date.now();
        const record = failures.get(email);
        if (record && record.count >= MAX_FAILURES && now < record.until) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
        if (!user || !valid) {
          const next = record && now < record.until ? record.count + 1 : 1;
          failures.set(email, { count: next, until: now + LOCK_MS });
          if (user) await audit("account.login_failed", { userId: user.id, req: request as Request });
          return null;
        }
        failures.delete(email);

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await audit("account.login", { userId: user.id, req: request as Request });

        return { id: user.id, email: user.email, name: user.name, sv: user.sessionVersion } as {
          id: string;
          email: string;
          name: string | null;
          sv: number;
        };
      },
    }),
  ],
});

/**
 * The signed-in user, or null. A session issued before the account's sessionVersion
 * changed (password change, suspension, sign-out-everywhere, deletion) is rejected.
 */
export async function getUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
  if (!user) return null;
  const sv = (session as { sv?: number }).sv ?? 0;
  if (sv !== user.sessionVersion) return null;
  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

/**
 * auth() for API routes, with the same session-version check as getUser().
 */
export async function authSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { sessionVersion: true } });
  if (!user || ((session as { sv?: number }).sv ?? 0) !== user.sessionVersion) return null;
  return session as typeof session & { user: { id: string } };
}
