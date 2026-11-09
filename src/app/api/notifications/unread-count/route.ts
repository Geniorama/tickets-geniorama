import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const maxDuration = 10;

/**
 * Contador de notificaciones sin leer, para el sondeo de la campana.
 *
 * Es una ruta y no un Server Action a propósito: los Server Actions se
 * ejecutan en fila por navegador, así que un sondeo colgado bloqueaba todos
 * los botones de la app. Un `fetch` normal es independiente y se puede
 * cancelar con un tiempo límite.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const count = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
