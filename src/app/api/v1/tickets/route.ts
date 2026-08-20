import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiOk,
  dateString,
  readJson,
  readPagination,
  requireActor,
  resolveActingUser,
} from "@/lib/api/respond";
import { createTicketViaApi, listTickets } from "@/lib/api/tickets";

/**
 * Tickets: listar y crear.
 *
 *   GET  /api/v1/tickets?status=&assignedToId=&limit=&cursor=
 *   POST /api/v1/tickets
 *
 * `onBehalfOf` (id o email) atribuye el ticket a otra persona y exige el permiso
 * `act_as`. Es lo que necesita un bot que atiende clientes: el ticket queda a
 * nombre de quien lo pidió, con su plan y su empresa, no a nombre del bot.
 *
 * Sin `status`, el ticket nace POR_ASIGNAR: lo que llega por una integración
 * todavía no tiene dueño y pasa por la misma bandeja de triaje que el resto.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().trim().min(1, "title es requerido").max(200),
  description: z.string().trim().min(1, "description es requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  status: z.enum(["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"]).optional(),
  category: z.string().trim().max(80).optional(),
  assignedToId: z.string().optional(),
  siteId: z.string().optional(),
  dueDate: dateString.optional(),
  onBehalfOf: z.string().trim().min(1).optional(),
});

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const { limit, cursor } = readPagination(req);

  const result = await listTickets(actor.user, {
    limit,
    cursor,
    status: url.searchParams.get("status") ?? undefined,
    assignedToId: url.searchParams.get("assignedToId") ?? undefined,
  });

  return apiOk(result);
}

export async function POST(req: Request) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });
  }

  const author = await resolveActingUser(actor, parsed.data.onBehalfOf);
  if (author instanceof NextResponse) return author;

  const result = await createTicketViaApi(author, actor.keyLabel, {
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    status: parsed.data.status,
    category: parsed.data.category ?? null,
    assignedToId: parsed.data.assignedToId ?? null,
    siteId: parsed.data.siteId ?? null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
  });

  if (!result.ok) return apiError(result.error, result.status);
  return apiOk({ ticket: result.value }, 201);
}
