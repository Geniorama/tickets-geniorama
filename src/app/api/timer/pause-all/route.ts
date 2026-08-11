import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stopAllForUser } from "@/lib/time-entries";

export const maxDuration = 15;

/**
 * Detiene todos los timers activos del usuario autenticado.
 * Llamado por:
 *  - sendBeacon en beforeunload / pagehide (cierre de pestaña)
 *  - fetch antes de navegar a /api/logout
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // Una sola tabla compartida cubre tickets y tareas.
  await stopAllForUser(userId, now);

  return new NextResponse(null, { status: 204 });
}
