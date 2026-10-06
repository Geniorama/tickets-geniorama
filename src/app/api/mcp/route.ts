import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { buildMcpServer } from "@/lib/mcp/server";
import { authenticateBearer } from "@/lib/oauth/server";
import { mcpResourceUrl, protectedResourceMetadataUrl } from "@/lib/oauth/config";
import { CORS_HEADERS, preflight } from "@/lib/oauth/http";

/**
 * Endpoint MCP (Streamable HTTP), protegido con OAuth 2.1.
 *
 * Sin estado: cada POST trae su token, se arma un servidor para ese usuario y
 * se responde en JSON. No hay sesiones que guardar entre peticiones, así que
 * funciona igual con varias instancias de la app detrás de pm2.
 *
 * Sin token válido responde 401 con `WWW-Authenticate` apuntando a los
 * metadatos del recurso: es lo que hace que Claude o ChatGPT descubran solos
 * dónde registrarse y abran la pantalla de autorización.
 */

export const dynamic = "force-dynamic";

function unauthorized(hadToken: boolean) {
  const params = [`resource_metadata="${protectedResourceMetadataUrl()}"`];
  if (hadToken) params.push(`error="invalid_token"`, `error_description="Token inválido, vencido o revocado"`);
  return new Response(
    JSON.stringify({ error: hadToken ? "invalid_token" : "unauthorized", error_description: "Se requiere autorización" }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": `Bearer ${params.join(", ")}`,
        ...CORS_HEADERS,
      },
    },
  );
}

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function POST(req: Request) {
  const actor = await authenticateBearer(req);
  if (!actor) return unauthorized(/^Bearer\s+\S/i.test(req.headers.get("authorization") ?? ""));

  const server = buildMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  try {
    const res = await transport.handleRequest(req, {
      authInfo: {
        token: "",
        clientId: actor.clientId,
        scopes: actor.scopes,
        expiresAt: actor.expiresAt,
        resource: new URL(mcpResourceUrl()),
        extra: { userId: actor.user.id },
      },
    });
    return withCors(res);
  } catch (err) {
    console.error("[mcp]", err);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Error interno" }, id: null }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } },
    );
  } finally {
    // La respuesta es JSON completo (no stream), así que ya se puede cerrar
    void server.close();
  }
}

/**
 * Sin sesiones no hay canal de servidor a cliente que abrir ni sesión que
 * cerrar. Aun así, sin token se responde 401: hay clientes que descubren la
 * autorización con un GET antes de nada.
 */
async function methodNotAllowed(req: Request) {
  const actor = await authenticateBearer(req);
  if (!actor) return unauthorized(/^Bearer\s+\S/i.test(req.headers.get("authorization") ?? ""));
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Método no permitido" }, id: null }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS", ...CORS_HEADERS } },
  );
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const OPTIONS = preflight;
