import { NextResponse } from "next/server";
import { apiError, apiOk, requireAgentActor } from "@/lib/api/respond";
import { agentContext, requireAgentClient } from "@/lib/api/agent";

/**
 * Agente · todo lo del cliente en una llamada.
 *
 *   GET /api/v1/agent/context?client=<token de /agent/client>
 *
 * Planes (vencimiento, horas usadas y disponibles), tickets abiertos y cerrados
 * en los últimos 30 días, proyectos con su avance, servicios con su vencimiento,
 * sitios y, si el cliente tiene autorizada «Mi facturación», sus facturas
 * pendientes con link de pago. Recortado a lo que el cliente ve en la plataforma.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const client = await requireAgentClient(actor.keyId, new URL(req.url).searchParams.get("client"));
  if (!client.ok) return apiError(client.error, client.status);

  return apiOk({ context: await agentContext(client.value) });
}
