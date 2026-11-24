import { NextResponse } from "next/server";
import { apiError, apiOk, requireAgentActor } from "@/lib/api/respond";
import { findClient, issueClientToken } from "@/lib/api/agent";
import { HISTORY_DEFAULT, HISTORY_MAX, phoneToE164, recentHistory } from "@/lib/api/agent-messages";

/**
 * Agente · ¿quién escribe por WhatsApp?
 *
 *   GET /api/v1/agent/clients/by-phone?phone=573118364663&history=20
 *
 * Igual que `/agent/client?phone=`, más `history`: los últimos mensajes de esa
 * conversación (role user/assistant, del más viejo al más nuevo) para que el
 * agente tenga contexto. 404 si el teléfono no es de ningún cliente; 409 si
 * está en varias cuentas. `history` solo viaja si el agente está habilitado.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const rawPhone = url.searchParams.get("phone");
  if (!rawPhone) return apiError("Indica phone en formato E.164", 400, { code: "invalid" });
  const p = phoneToE164(rawPhone);
  if (!p.ok) return apiError(`Teléfono no válido: ${p.error}`, 400, { code: "invalid" });

  const r = await findClient({ phone: p.e164 });
  if (!r.ok) return apiError(r.error, r.status, { code: r.code });

  const n = Number(url.searchParams.get("history") ?? HISTORY_DEFAULT);
  const limit = Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), HISTORY_MAX) : HISTORY_DEFAULT;

  const { client, agentEnabled } = r;
  const token = agentEnabled ? issueClientToken(actor.keyId, client.id) : null;
  return apiOk({
    client: { id: client.id, name: client.name, email: client.email, companies: client.companies },
    phone: p.e164,
    agentEnabled,
    clientToken: token?.token ?? null,
    clientTokenExpiresAt: token?.expiresAt ?? null,
    history: agentEnabled && limit > 0 ? await recentHistory(p.e164, limit) : [],
  });
}
