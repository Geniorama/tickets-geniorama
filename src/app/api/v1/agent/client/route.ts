import { NextResponse } from "next/server";
import { apiError, apiOk, requireAgentActor } from "@/lib/api/respond";
import { findClient, issueClientToken } from "@/lib/api/agent";

/**
 * Agente · ¿quién escribe?
 *
 *   GET /api/v1/agent/client?phone=573001234567
 *   GET /api/v1/agent/client?email=cliente@empresa.com
 *
 * Es lo primero que llama el agente con cada mensaje. Responde aunque el plan
 * del cliente no incluya el agente (`agentEnabled: false`), para que el bot
 * pueda decírselo en vez de quedarse callado. Un 404 es un número que no está
 * en ninguna cuenta: el bot debe pedir que lo registren en *Mis integraciones*.
 *
 * Con el agente incluido devuelve `clientToken`: es lo que el resto de los
 * endpoints acepta en `client`. Lo firma la plataforma, vale para esta llave y
 * vence a las 6 h, así que el modelo no puede cambiar de cliente a mitad de la
 * conversación aunque se lo pidan.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const r = await findClient({
    phone: url.searchParams.get("phone"),
    email: url.searchParams.get("email"),
    id: url.searchParams.get("id"),
  });
  if (!r.ok) return apiError(r.error, r.status, { code: r.code });

  const { client, agentEnabled } = r;
  const token = agentEnabled ? issueClientToken(actor.keyId, client.id) : null;
  return apiOk({
    client: { id: client.id, name: client.name, email: client.email, companies: client.companies },
    agentEnabled,
    clientToken: token?.token ?? null,
    clientTokenExpiresAt: token?.expiresAt ?? null,
  });
}
