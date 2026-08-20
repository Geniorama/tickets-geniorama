import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import { apiError, apiOk, readPagination, requireActor } from "@/lib/api/respond";

/**
 * Directorio mínimo, para resolver a quién asignar o en nombre de quién escribir.
 *
 *   GET /api/v1/users?q=juan|correo@empresa.com
 *
 * Reservado a llaves de una cuenta del equipo: el directorio dice quién trabaja
 * aquí y con qué correo, y eso no tiene por qué salir por la llave de un
 * cliente. Devuelve lo justo para identificar a alguien, nada más.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  if (!isStaff(actor.user.role)) {
    return apiError("El directorio solo está disponible para llaves del equipo", 403);
  }

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const { limit } = readPagination(req);

  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, email: true, role: true, cargo: true },
    orderBy: { name: "asc" },
    take: limit,
  });

  return apiOk({ users });
}
