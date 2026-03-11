import { NextResponse } from "next/server";

/**
 * GET /api/logout
 * Limpia las cookies de sesión de NextAuth v5 (authjs.*) con atributos exactos
 * y redirige al login. Más fiable que signOut() desde Server Action o cliente.
 */
export async function GET(request: Request) {
  const loginUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(loginUrl);

  // NextAuth v5 usa prefijo "authjs" (no "next-auth" que era v4).
  // __Host- requiere: Secure, Path=/, sin Domain.
  // __Secure- requiere: Secure.
  // Usamos Set-Cookie raw para controlar atributos exactos.
  const secureCookies = [
    "__Secure-authjs.session-token",
    "__Secure-authjs.callback-url",
  ];
  const hostCookies = [
    "__Host-authjs.csrf-token",
  ];
  // Fallback HTTP (desarrollo local sin HTTPS)
  const plainCookies = [
    "authjs.session-token",
    "authjs.csrf-token",
    "authjs.callback-url",
  ];

  for (const name of secureCookies) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  for (const name of hostCookies) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
    );
  }
  for (const name of plainCookies) {
    response.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
    );
  }

  return response;
}
