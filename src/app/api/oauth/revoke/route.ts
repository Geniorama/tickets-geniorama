import { authenticateClient, revokeToken } from "@/lib/oauth/server";
import { oauthErrorResponse, preflight, readForm, CORS_HEADERS } from "@/lib/oauth/http";

/** Revocación (RFC 7009). Responde 200 aunque el token no exista, como pide el estándar. */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const form = await readForm(req);
    const client = await authenticateClient(req, form);
    await revokeToken(client.id, form.get("token") ?? "");
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  } catch (err) {
    return oauthErrorResponse(err);
  }
}

export const OPTIONS = preflight;
