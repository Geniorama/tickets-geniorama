import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

  await Promise.all([
    prisma.timeEntry.updateMany({
      where: { userId, stoppedAt: null },
      data: { stoppedAt: now },
    }),
    prisma.taskTimeEntry.updateMany({
      where: { userId, stoppedAt: null },
      data: { stoppedAt: now },
    }),
  ]);

  return new NextResponse(null, { status: 204 });
}
