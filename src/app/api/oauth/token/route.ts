import {
  OAuthError,
  authenticateClient,
  exchangeAuthorizationCode,
  refreshGrant,
} from "@/lib/oauth/server";
import { oauthErrorResponse, oauthJson, preflight, readForm } from "@/lib/oauth/http";

/** Endpoint de token: canje del código (con PKCE) y refresco con rotación. */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await readForm(req);
    const client = await authenticateClient(req, form);

    switch (form.get("grant_type")) {
      case "authorization_code":
        return oauthJson(await exchangeAuthorizationCode(client.id, form));
      case "refresh_token":
        return oauthJson(await refreshGrant(client.id, form));
      default:
        throw new OAuthError("unsupported_grant_type", "grant_type admitidos: authorization_code, refresh_token");
    }
  } catch (err) {
    return oauthErrorResponse(err);
  }
}

export const OPTIONS = preflight;
