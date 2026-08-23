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
 *
 * El nombre va separado en `firstName` y `lastName`, pero se sigue aceptando
 * `name` entero: quitarlo rompería los workflows escritos antes de la
 * separación, y partirlo aquí cuesta nada.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  /** Nombre entero. Se sigue aceptando por compatibilidad y se parte al guardar. */
  name: z.string().trim().min(1).max(160).optional(),
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
  if (!parsed.data.firstName && !parsed.data.name) {
    return apiError("Falta el nombre: manda `firstName` o `name`.", 400);
  }

  const { id } = await params;
  const result = await createContactViaApi(actor.user, id, parsed.data);
  if (!result.ok) return apiError(result.error, result.status);

  return apiOk({ contact: result.value }, 201);
}
