/**
 * Andamiaje común de la API pública.
 *
 * Todos los endpoints de `/api/v1` responden con la misma forma —`{ ok, ... }`—
 * y fallan con la misma forma, para que quien integra escriba un solo manejador
 * de errores y no uno por ruta.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  authenticateApiKey,
  hasScope,
  isAuthFailure,
  type ApiActor,
  type ApiScope,
} from "@/lib/api/keys";

export type ApiUser = { id: string; name: string; email: string; role: ApiActor["user"]["role"] };

export function apiOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function apiError(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/**
 * Autentica y exige un permiso. Devuelve el actor, o la respuesta ya lista para
 * devolver: `if (actor instanceof NextResponse) return actor;`.
 */
export async function requireActor(
  req: Request,
  scope: ApiScope,
): Promise<ApiActor | NextResponse> {
  const actor = await authenticateApiKey(req);
  if (isAuthFailure(actor)) return apiError(actor.error, actor.status);
  if (!hasScope(actor, scope)) {
    return apiError(`La llave no tiene el permiso "${scope}"`, 403);
  }
  return actor;
}

/** Lee el cuerpo JSON, o devuelve la respuesta de error correspondiente. */
export async function readJson(req: Request): Promise<unknown | NextResponse> {
  try {
    return await req.json();
  } catch {
    return apiError("El cuerpo no es JSON válido", 400);
  }
}

/**
 * Quién figura como autor de lo que se cree.
 *
 * Por defecto es el usuario dueño de la llave. Con `onBehalfOf` (id o email) se
 * atribuye a otra persona, que es lo que necesita un bot que atiende a varios
 * clientes: el ticket tiene que quedar a nombre de quien lo pidió, no del robot.
 * Exige el permiso `act_as` porque es, literalmente, escribir como otro.
 *
 * Dos frenos para que suplantar no sea una forma de ascender:
 *
 *   · Solo una llave atada a una cuenta del **equipo** puede suplantar. Si no,
 *     bastaría con darle `act_as` a la llave de un cliente para que escribiera
 *     como administrador — justo lo que el permiso de rol impide en la interfaz.
 *   · Ni siquiera esa llave puede suplantar a un administrador. Un bot que
 *     atiende clientes no tiene por qué actuar nunca como quien manda.
 */
export async function resolveActingUser(
  actor: ApiActor,
  onBehalfOf?: string | null,
): Promise<ApiUser | NextResponse> {
  if (!onBehalfOf) return actor.user;

  if (!hasScope(actor, "act_as")) {
    return apiError('La llave no tiene el permiso "act_as" para usar onBehalfOf', 403);
  }

  if (actor.user.role === "CLIENTE") {
    return apiError("Una llave de cliente no puede escribir en nombre de otra persona", 403);
  }

  const needle = onBehalfOf.trim();
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [{ id: needle }, { email: needle.toLowerCase() }],
    },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) return apiError(`No encuentro un usuario activo para "${onBehalfOf}"`, 404);

  if (user.role === "ADMINISTRADOR" && user.id !== actor.user.id) {
    return apiError("No se puede escribir en nombre de un administrador", 403);
  }

  return user;
}

/**
 * Fecha en texto, tal como la manda quien integra.
 *
 * Se acepta cualquier cosa que `Date` sepa leer —ISO completo, `2026-08-20`, lo
 * que escupa n8n— en vez de imponer un formato: rechazar una fecha válida por
 * la forma es la clase de fricción que hace abandonar una API.
 */
export const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "La fecha no es válida");

/** Paginación uniforme: `?limit=&cursor=`, con tope duro. */
export function readPagination(req: Request): { limit: number; cursor: string | null } {
  const url = new URL(req.url);
  const raw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 100) : 50;
  return { limit, cursor: url.searchParams.get("cursor") };
}
