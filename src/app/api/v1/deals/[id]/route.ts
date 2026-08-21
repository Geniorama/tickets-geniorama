import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, dateString, readJson, requireActor } from "@/lib/api/respond";
import { getDeal, isDenied, updateDealViaApi } from "@/lib/api/crm";

/**
 * Una oportunidad concreta.
 *
 *   GET   /api/v1/deals/:id
 *   PATCH /api/v1/deals/:id   — solo los campos que se manden
 *
 * Mandar `stage` la mueve en el pipeline igual que arrastrar la tarjeta: sella
 * o borra la fecha de cierre y dispara `deal.stage_changed` más `deal.won` o
 * `deal.lost`. Es el endpoint con el que un firmador de contratos cierra la
 * venta solo.
 */

export const dynamic = "force-dynamic";

const DEAL_STAGE = ["NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA"] as const;

const patchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  stage: z.enum(DEAL_STAGE).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  expectedCloseAt: dateString.nullable().optional(),
  contactId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  lostReason: z.string().trim().max(200).nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const result = await getDeal(actor.user, id);
  if (isDenied(result)) return apiError(result.error, result.status);
  if (!result) return apiError("Oportunidad no encontrada", 404);

  return apiOk(result);
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
  const { expectedCloseAt, ...rest } = parsed.data;

  const result = await updateDealViaApi(actor.user, id, {
    ...rest,
    ...(expectedCloseAt !== undefined
      ? { expectedCloseAt: expectedCloseAt === null ? null : new Date(expectedCloseAt) }
      : {}),
  });
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ deal: result.value });
}
