import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireAgentActor } from "@/lib/api/respond";
import { agentComment, requireAgentClient } from "@/lib/api/agent";

/**
 * Agente · comentar un ticket del cliente.
 *
 *   POST /api/v1/agent/tickets/:id/comments
 *   { "client": "...", "body": "...", "internal": false }
 *
 * Firma la cuenta del equipo dueña de la llave. `internal: true` deja una nota
 * que el cliente no ve —el resumen de la conversación, lo que ya se descartó—
 * y avisa al responsable del ticket. Es la única vía de la API que escribe
 * notas internas, y solo con el permiso `agent`.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  client: z.string().trim().min(1, "client es requerido"),
  body: z.string().trim().min(1, "body es requerido").max(10000),
  internal: z.boolean().default(false),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });

  const client = await requireAgentClient(actor.keyId, parsed.data.client);
  if (!client.ok) return apiError(client.error, client.status);

  const { id } = await params;
  const r = await agentComment(actor.user, client.value, decodeURIComponent(id), parsed.data.body, parsed.data.internal);
  if (!r.ok) return apiError(r.error, r.status);
  return apiOk({ comment: r.value }, 201);
}
