import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", newUser: "/dashboard" },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin");
      if (isDashboard && !isLoggedIn) {
        // Build the sign-in URL from the Host the visitor used. Auth.js rewrites request.url to
        // its configured base URL, so the origin has to come from the forwarded headers.
        const raw = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
        const trusted = /^(heysilo\.co|[a-z0-9-]+\.vercel\.app|localhost(:\d+)?)$/.test(raw);
        const host = trusted ? raw : "heysilo.co";
        const proto = host.startsWith("localhost") ? "http" : "https";
        const signIn = new URL("/sign-in", `${proto}://${host}`);
        signIn.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
        return Response.redirect(signIn);
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.sv = (user as { sv?: number }).sv ?? 0;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      (session as { sv?: number }).sv = typeof token.sv === "number" ? token.sv : 0;
      return session;
    },
  },
};
