import type { NextAuthConfig } from "next-auth";

/**
 * Configuración edge-compatible de NextAuth.
 * NO debe importar prisma, bcrypt ni ningún módulo de Node.js.
 * Solo se usa en el middleware.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" as const },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isApiAuth = nextUrl.pathname.startsWith("/api/auth");
      const isAuthRoute =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/set-password");

      if (isApiAuth) return true;

      if (isAuthRoute) {
        // /set-password siempre accesible (no redirigir al dashboard si está logueado)
        if (isLoggedIn && nextUrl.pathname.startsWith("/login")) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }

      if (!isLoggedIn) {
        return false; // NextAuth redirige a pages.signIn automáticamente
      }

      return true;
    },
  },
  providers: [], // los providers reales van en auth.ts
} satisfies NextAuthConfig;
