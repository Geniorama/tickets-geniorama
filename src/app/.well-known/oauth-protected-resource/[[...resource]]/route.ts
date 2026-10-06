import { OAUTH_SCOPES, appBaseUrl, mcpResourceUrl } from "@/lib/oauth/config";
import { oauthJson, preflight } from "@/lib/oauth/http";

/**
 * Metadatos del recurso protegido (RFC 9728). Se sirve en la raíz y con el
 * sufijo `/api/mcp`, que es donde lo busca el estándar para un recurso con ruta.
 */

export const dynamic = "force-dynamic";

export function GET() {
  return oauthJson({
    resource: mcpResourceUrl(),
    authorization_servers: [appBaseUrl()],
    scopes_supported: [...OAUTH_SCOPES],
    bearer_methods_supported: ["header"],
    resource_name: "Geniorama",
  });
}

export const OPTIONS = preflight;
