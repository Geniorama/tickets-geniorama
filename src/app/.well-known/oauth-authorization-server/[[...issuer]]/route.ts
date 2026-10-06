import { OAUTH_SCOPES, appBaseUrl } from "@/lib/oauth/config";
import { oauthJson, preflight } from "@/lib/oauth/http";

/** Metadatos del servidor de autorización (RFC 8414). */

export const dynamic = "force-dynamic";

export function GET() {
  const base = appBaseUrl();
  return oauthJson({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/register`,
    revocation_endpoint: `${base}/api/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: [...OAUTH_SCOPES],
  });
}

export const OPTIONS = preflight;
