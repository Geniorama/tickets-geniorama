import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, dateString, readJson, readPagination, requireActor } from "@/lib/api/respond";
import { createDealViaApi, isDenied, listDeals } from "@/lib/api/crm";

/**
 * Oportunidades.
 *
 *   GET  /api/v1/deals?stage=&accountId=&open=true&limit=&cursor=
 *   POST /api/v1/deals
 *
 * `open=true` es el filtro que quiere cualquier panel externo: el pipeline vivo
 * sin tener que saberse qué etapas son terminales.
 */

export const dynamic = "force-dynamic";

const DEAL_STAGE = ["NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1, "El título es requerido").max(160),
  accountId: z.string().min(1, "La cuenta es requerida"),
  stage: z.enum(DEAL_STAGE).optional(),
  amount: z.number().nonnegative("El valor no puede ser negativo").nullable().optional(),
  expectedCloseAt: dateString.nullable().optional(),
  contactId: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const { limit, cursor } = readPagination(req);
  const openParam = url.searchParams.get("open");

  const result = await listDeals(actor.user, {
    limit,
    cursor,
    stage: url.searchParams.get("stage") ?? undefined,
    accountId: url.searchParams.get("accountId") ?? undefined,
    open: openParam === null ? undefined : openParam !== "false",
  });
  if (isDenied(result)) return apiError(result.error, result.status);

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

  const { expectedCloseAt, ...rest } = parsed.data;

  const result = await createDealViaApi(actor.user, {
    ...rest,
    expectedCloseAt: expectedCloseAt ? new Date(expectedCloseAt) : null,
  });
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ deal: result.value }, 201);
}
