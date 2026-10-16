import { NextResponse } from "next/server";
import { apiError, apiOk, requireAgentActor } from "@/lib/api/respond";
import { agentTicket, requireAgentClient } from "@/lib/api/agent";

/**
 * Agente · un ticket del cliente, con sus comentarios públicos.
 *
 *   GET /api/v1/agent/tickets/:id?client=<token de /agent/client>
 *
 * `:id` acepta el id o el código que conoce el cliente («ACM-12»). Un ticket que
 * no es del cliente responde 404, igual que uno que no existe.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const client = await requireAgentClient(actor.keyId, new URL(req.url).searchParams.get("client"));
  if (!client.ok) return apiError(client.error, client.status);

  const { id } = await params;
  const ticket = await agentTicket(client.value, decodeURIComponent(id));
  if (!ticket) return apiError("No encuentro ese ticket entre los del cliente", 404);
  return apiOk({ ticket });
}
