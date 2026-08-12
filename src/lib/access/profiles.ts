import { prisma } from "@/lib/prisma";

/**
 * Perfiles disponibles para el selector de acceso.
 *
 * Es un helper de servidor, no un Server Action: lo consume la página al
 * renderizar. Cuando esto vivía en `access.actions.ts` con `"use server"`, el
 * render de la página de edición invocaba una acción y su guardia interno
 * fallaba, redirigiendo al dashboard.
 *
 * No lleva comprobación propia de permisos: la página que lo usa ya exige
 * el chequeo de administrador antes de llamarlo.
 */
export function listAccessProfiles() {
  return prisma.accessProfile.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    select: { id: true, name: true, description: true, grants: true, isSystem: true },
  });
}
