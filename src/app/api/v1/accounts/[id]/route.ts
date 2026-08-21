import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireActor } from "@/lib/api/respond";
import { getAccount, isDenied, updateAccountViaApi } from "@/lib/api/crm";

/**
 * Una cuenta concreta.
 *
 *   GET   /api/v1/accounts/:id
 *   PATCH /api/v1/accounts/:id   — solo los campos que se manden
 *
 * Mandar `stage` es lo que dispara `account.stage_changed`, así que cerrar un
 * lead desde fuera y enterarse por webhook es el mismo movimiento.
 */

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  stage: z.enum(["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"]).optional(),
  taxId: z.string().trim().max(60).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
  ownerId: z.string().nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const result = await getAccount(actor.user, id);
  if (isDenied(result)) return apiError(result.error, result.status);
  if (!result) return apiError("Cuenta no encontrada", 404);

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
  const result = await updateAccountViaApi(actor.user, id, parsed.data);
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ account: result.value });
}
