import { NextResponse } from "next/server";
import { HOOK_EVENTS } from "@/lib/hooks/events";
import { apiOk, requireActor } from "@/lib/api/respond";

/**
 * Catálogo de eventos que puede recibir un hook.
 *
 * Se expone por API además de estar en la pantalla para que un workflow pueda
 * comprobar contra qué eventos está escrito sin que nadie tenga que copiar una
 * lista a mano y dejarla desactualizada.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  return apiOk({ events: HOOK_EVENTS });
}
