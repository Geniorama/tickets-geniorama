import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, dateString, readJson, readPagination, requireActor } from "@/lib/api/respond";
import { isDenied, listActivities, logActivityViaApi } from "@/lib/api/crm";

/**
 * El historial de una cuenta.
 *
 *   GET  /api/v1/accounts/:id/activities?limit=&cursor=
 *   POST /api/v1/accounts/:id/activities
 *
 * El POST es el endpoint que más se va a usar del CRM: la centralita cuelga una
 * llamada, el buzón recibe un correo, y queda apuntado sin que nadie lo teclee.
 * `occurredAt` es opcional porque un sistema que avisa en el momento no tiene
 * que calcular la fecha; si llega tarde, la manda.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  summary: z.string().trim().min(1, "Escribe qué pasó").max(200),
  type: z.enum(["NOTA", "LLAMADA", "CORREO", "REUNION", "WHATSAPP"]).optional(),
  notes: z.string().max(4000).nullable().optional(),
  occurredAt: dateString.nullable().optional(),
  contactId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const { limit, cursor } = readPagination(req);

  const result = await listActivities(actor.user, { limit, cursor, accountId: id });
  if (isDenied(result)) return apiError(result.error, result.status);

  return apiOk(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });
  }

  const { id } = await params;
  const { occurredAt, ...rest } = parsed.data;

  const result = await logActivityViaApi(actor.user, id, {
    ...rest,
    occurredAt: occurredAt ? new Date(occurredAt) : null,
  });
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ activity: result.value }, 201);
}
