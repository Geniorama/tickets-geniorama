import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, dateString, readJson, requireActor } from "@/lib/api/respond";
import { getTicket, updateTicketViaApi } from "@/lib/api/tickets";

/**
 * Un ticket concreto.
 *
 *   GET   /api/v1/tickets/:id
 *   PATCH /api/v1/tickets/:id   — solo los campos que se manden
 *
 * El PATCH distingue «no lo mandes» de «ponlo en null»: `category: null` borra
 * la categoría, omitirla la deja como estaba. Sin esa distinción, actualizar el
 * estado obligaría a reenviar el ticket entero y a arriesgarse a pisar lo que
 * alguien cambió mientras tanto.
 */

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"]).optional(),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  dueDate: dateString.nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const ticket = await getTicket(actor.user, id);
  if (!ticket) return apiError("Ticket no encontrado", 404);

  return apiOk({ ticket });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });
  }

  const { id } = await params;
  const { dueDate, ...rest } = parsed.data;

  const result = await updateTicketViaApi(actor.user, id, {
    ...rest,
    ...(dueDate !== undefined ? { dueDate: dueDate === null ? null : new Date(dueDate) } : {}),
  });

  if (!result.ok) return apiError(result.error, result.status);
  return apiOk({ ticket: result.value });
}
