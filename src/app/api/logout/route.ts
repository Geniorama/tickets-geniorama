import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * GET /api/logout
 * Borra todos los cookies de sesión de NextAuth y redirige al login.
 * Más fiable que signOut() desde un Server Action en NextAuth v5 beta.
 */
export async function GET(request: Request) {
  const cookieStore = await cookies();

  // NextAuth v5 usa estos nombres de cookie (HTTP y HTTPS)
  const authCookies = [
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.csrf-token",
    "__Host-next-auth.csrf-token",
    "next-auth.callback-url",
    "__Secure-next-auth.callback-url",
  ];

  for (const name of authCookies) {
    cookieStore.delete(name);
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}
