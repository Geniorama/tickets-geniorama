/**
 * Respuestas de los endpoints OAuth y MCP. Llevan CORS abierto porque los
 * clientes MCP que corren en el navegador (el Inspector, por ejemplo) leen los
 * metadatos y piden tokens desde otro origen. No hay cookies de por medio: todo
 * va con tokens en cabecera, así que abrir el origen no expone la sesión.
 */

import { OAuthError } from "@/lib/oauth/server";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export function oauthJson(body: unknown, status = 200, extra?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      // RFC 6749 §5.1: las respuestas con tokens no se cachean
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...CORS_HEADERS,
      ...extra,
    },
  });
}

export function oauthErrorResponse(err: unknown) {
  if (err instanceof OAuthError) return oauthJson(err.toJSON(), err.status);
  console.error("[oauth]", err);
  return oauthJson({ error: "server_error", error_description: "Error interno" }, 500);
}

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/** El endpoint de token recibe form-urlencoded (RFC 6749); se tolera JSON. */
export async function readForm(req: Request): Promise<URLSearchParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return new URLSearchParams(
      Object.entries(body).filter(([, v]) => typeof v === "string") as [string, string][],
    );
  }
  return new URLSearchParams(await req.text());
}
