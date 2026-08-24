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
 *
 * El **correo sí es obligatorio**, y eso sí rompe a quien creaba contactos sin
 * él. Se asume a conciencia: un contacto sin correo no entra en ninguna
 * campaña, así que crearlo solo aplaza el problema. El teléfono se guarda
 * siempre en E.164.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().max(80).nullable().optional(),
  /** Nombre entero. Se sigue aceptando por compatibilidad y se parte al guardar. */
  name: z.string().trim().min(1).max(160).optional(),
  // Obligatorio desde la v1.76.0: un contacto sin correo no sirve para una
  // campaña. Es un cambio incompatible y va anunciado en la referencia.
  email: z.string().min(1, "El correo es obligatorio").email("El correo no es válido").max(160),
  phone: z.string().trim().max(60).nullable().optional(),
  /** Indicativo para los números que llegan sin él. Por defecto, Colombia. */
  phoneDial: z.string().trim().max(6).nullable().optional(),
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
