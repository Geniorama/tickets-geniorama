import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireAgentActor } from "@/lib/api/respond";
import { agentCreateTicket, requireAgentClient } from "@/lib/api/agent";

/**
 * Agente · abrir un ticket a nombre del cliente.
 *
 *   POST /api/v1/agent/tickets
 *   { "client": "...", "title": "...", "description": "...", "priority"?, "siteId"? }
 *
 * Es la salida cuando el agente no puede resolver algo. Nace POR_ASIGNAR, contra
 * el plan vigente del cliente y con los mismos avisos que si lo abriera él.
 * Sin plan vigente responde 422: el bot debe decirlo, no insistir.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  client: z.string().trim().min(1, "client es requerido"),
  title: z.string().trim().min(1, "title es requerido").max(200),
  description: z.string().trim().min(1, "description es requerida").max(20000),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  siteId: z.string().trim().min(1).optional(),
  category: z.string().trim().max(80).optional(),
});

export async function POST(req: Request) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });

  const client = await requireAgentClient(actor.keyId, parsed.data.client);
  if (!client.ok) return apiError(client.error, client.status);

  const { title, description, priority, siteId, category } = parsed.data;
  const r = await agentCreateTicket(client.value, actor.keyLabel, { title, description, priority, siteId, category });
  if (!r.ok) return apiError(r.error, r.status);
  return apiOk({ ticket: r.value }, 201);
}
