import { NextResponse } from "next/server";

/**
 * GET /api/logout
 * Excluido del middleware de NextAuth (ver matcher en middleware.ts) para que
 * los Set-Cookie de borrado no sean sobreescritos por el wrapper de auth.
 */
export async function GET(request: Request) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);

  // No cachear bajo ninguna circunstancia.
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");

  // NextAuth v5 usa prefijo "authjs" (v4 usaba "next-auth").
  // __Host-  → requiere: Secure, Path=/, sin Domain attribute.
  // __Secure-→ requiere: Secure.
  const cookiesToClear = [
    // HTTPS (producción)
    `__Secure-authjs.session-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    `__Secure-authjs.callback-url=; Path=/; Max-Age=0; Secure; SameSite=Lax`,
    `__Host-authjs.csrf-token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    // HTTP (desarrollo local)
    `authjs.session-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    `authjs.callback-url=; Path=/; Max-Age=0; SameSite=Lax`,
    `authjs.csrf-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
  ];

  for (const cookie of cookiesToClear) {
    response.headers.append("Set-Cookie", cookie);
  }

  return response;
}
