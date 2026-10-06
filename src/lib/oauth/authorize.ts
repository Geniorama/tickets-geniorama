/**
 * Validación de una petición de autorización (`/oauth/authorize`). La usan la
 * pantalla, para decidir qué mostrar, y el POST que aprueba, para no fiarse de
 * lo que vuelva en el formulario.
 */

import { appBaseUrl, type OAuthScope } from "@/lib/oauth/config";
import { OAuthError, checkResource, getClient, parseScopes, redirectUriAllowed } from "@/lib/oauth/server";

export type AuthorizeRequest = {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string | null;
  scopes: OAuthScope[];
  codeChallenge: string;
  resource: string;
};

export type AuthorizeCheck =
  | { ok: true; request: AuthorizeRequest }
  /** Sin cliente o redirect_uri fiables: no se puede devolver el error a la app. */
  | { ok: false; redirect: null; message: string }
  /** Error que se devuelve a la app por su redirect_uri, como manda OAuth. */
  | { ok: false; redirect: string; message: string };

export const AUTHORIZE_FIELDS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "state",
  "scope",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;

export function redirectWith(redirectUri: string, params: Record<string, string | null>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  // RFC 9207: el cliente comprueba que la respuesta viene de quien esperaba
  url.searchParams.set("iss", appBaseUrl());
  return url.toString();
}

export async function checkAuthorizeRequest(get: (k: string) => string | null): Promise<AuthorizeCheck> {
  const clientId = get("client_id") ?? "";
  const redirectUri = get("redirect_uri") ?? "";
  const state = get("state");

  const client = await getClient(clientId);
  if (!client) return { ok: false, redirect: null, message: "La aplicación no está registrada." };
  if (!redirectUri || !redirectUriAllowed(client.redirectUris, redirectUri)) {
    return { ok: false, redirect: null, message: "La dirección de retorno no coincide con la registrada por la aplicación." };
  }

  const fail = (error: string, description: string): AuthorizeCheck => ({
    ok: false,
    redirect: redirectWith(redirectUri, { error, error_description: description, state }),
    message: description,
  });

  if (get("response_type") !== "code") return fail("unsupported_response_type", "Solo se admite response_type=code");
  const codeChallenge = get("code_challenge") ?? "";
  if (!codeChallenge || get("code_challenge_method") !== "S256") {
    return fail("invalid_request", "PKCE es obligatorio (code_challenge con método S256)");
  }

  try {
    const scopes = parseScopes(get("scope"));
    const resource = checkResource(get("resource"));
    return {
      ok: true,
      request: { clientId, clientName: client.name, redirectUri, state, scopes, codeChallenge, resource },
    };
  } catch (err) {
    if (err instanceof OAuthError) return fail(err.code, err.message);
    throw err;
  }
}
