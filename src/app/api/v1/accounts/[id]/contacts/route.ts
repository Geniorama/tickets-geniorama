import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireActor } from "@/lib/api/respond";
import { createContactViaApi, isDenied, listContacts } from "@/lib/api/crm";

/**
 * Los contactos de una cuenta.
 *
 *   GET  /api/v1/accounts/:id/contacts
 *   POST /api/v1/accounts/:id/contacts
 *
 * Cuelgan de la cuenta y no viven sueltos: un contacto sin empresa no existe en
 * este CRM, y tenerlo en la ruta ahorra al integrador mandar `accountId` en el
 * cuerpo y equivocarse de empresa.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().trim().min(1, "El nombre es requerido").max(160),
  email: z.string().email("El correo no es válido").max(160).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  position: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const result = await listContacts(actor.user, id);
  if (isDenied(result)) return apiError(result.error, result.status);
  if (!result) return apiError("Cuenta no encontrada", 404);

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
  const result = await createContactViaApi(actor.user, id, parsed.data);
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ contact: result.value }, 201);
}
