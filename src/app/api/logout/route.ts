/**
 * GET /api/logout
 *
 * Excluido del middleware de NextAuth (ver src/middleware.ts) para que
 * el wrapper de auth no re-inserte la cookie de sesión en el response.
 *
 * Estrategia:
 * - Lee TODOS los nombres de cookie del request y genera un Set-Cookie
 *   de borrado para cada uno, con los atributos correctos según prefijo.
 * - Retorna 200 OK con JS que navega a /login DESPUÉS de que el browser
 *   haya procesado los Set-Cookie. Más fiable que un redirect 307 donde
 *   algunos proxies/CDN pueden ignorar los Set-Cookie del response.
 */
export async function GET(request: Request) {
  // Leer todos los nombres de cookie enviados por el browser.
  const cookieHeader = request.headers.get("cookie") ?? "";
  const names = cookieHeader
    .split(";")
    .map((c) => c.trim().split("=")[0].trim())
    .filter(Boolean);

  const setCookies: string[] = [];

  for (const name of names) {
    if (name.startsWith("__Host-")) {
      // __Host- requiere: Secure, Path=/, sin Domain.
      setCookies.push(`${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    } else if (name.startsWith("__Secure-")) {
      // __Secure- requiere: Secure.
      setCookies.push(`${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
    } else {
      setCookies.push(`${name}=; Path=/; Max-Age=0; SameSite=Lax`);
    }
  }

  const html = `<!doctype html><html><head><meta charset="utf-8">
<script>window.location.replace("/login");</script>
</head><body></body></html>`;

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  });

  for (const cookie of setCookies) {
    headers.append("Set-Cookie", cookie);
  }

  return new Response(html, { status: 200, headers });
}
