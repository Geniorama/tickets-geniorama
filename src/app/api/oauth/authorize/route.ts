import { auth } from "@/auth";
import { appBaseUrl } from "@/lib/oauth/config";
import { checkAuthorizeRequest, redirectWith } from "@/lib/oauth/authorize";
import { createAuthorizationCode } from "@/lib/oauth/server";

/**
 * Decisión de la pantalla de consentimiento. Es un POST de formulario normal
 * (no una server action) para que la vuelta a la app sea un 303 que el
 * navegador sigue aunque la redirect_uri sea un esquema propio (`cursor://…`).
 *
 * Contra CSRF: solo se acepta si el formulario sale de la propia app. Sin ese
 * freno, otra web podría auto-enviar «Autorizar» con la sesión del usuario.
 */

export const dynamic = "force-dynamic";

function sameOrigin(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  const origin = req.headers.get("origin");
  if (!origin) return site === "same-origin";
  return origin === new URL(appBaseUrl()).origin;
}

function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location } });
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response("Origen no permitido", { status: 403 });

  const session = await auth();
  if (!session?.user) return seeOther(`${appBaseUrl()}/login`);

  const form = new URLSearchParams(await req.text());
  const check = await checkAuthorizeRequest((k) => form.get(k));
  if (!check.ok) {
    if (check.redirect) return seeOther(check.redirect);
    return new Response(check.message, { status: 400 });
  }

  const { request } = check;
  if (form.get("decision") !== "approve") {
    return seeOther(
      redirectWith(request.redirectUri, {
        error: "access_denied",
        error_description: "El usuario canceló la autorización",
        state: request.state,
      }),
    );
  }

  const code = await createAuthorizationCode({
    clientId: request.clientId,
    userId: session.user.id,
    redirectUri: request.redirectUri,
    codeChallenge: request.codeChallenge,
    scopes: request.scopes,
    resource: request.resource,
  });

  return seeOther(redirectWith(request.redirectUri, { code, state: request.state }));
}
