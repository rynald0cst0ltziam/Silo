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
        // Build the sign-in URL from the request itself so visitors stay on the domain they used.
        const signIn = new URL("/sign-in", request.nextUrl.origin);
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
