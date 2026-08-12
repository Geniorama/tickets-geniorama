"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import type { AccessLevel, AppKey } from "@/generated/prisma";
import { APP_BY_KEY, LEVEL_ORDER } from "@/lib/access/apps";

/**
 * Asigna un perfil y, opcionalmente, excepciones por módulo.
 *
 * Las excepciones se guardan siempre —incluido SIN_ACCESO— para que la
 * pantalla muestre el nivel efectivo sin tener que interpretar el JSON del
 * perfil. Un nivel sobre un módulo que el rol no admite se descarta aquí, para
 * que la base no guarde concesiones que `can()` va a ignorar de todas formas.
 */
export async function updateUserAccess(
  userId: string,
  profileId: string | null,
  levels: Partial<Record<AppKey, AccessLevel>>,
) {
  const session = await requireRole(["ADMINISTRADOR"]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return { error: "Usuario no encontrado" };

  // Ahora que la administración se rige por este nivel, quitárselo a uno mismo
  // significa perder el acceso a esta misma pantalla y no poder devolvérselo.
  if (userId === session.user.id && levels.ADMIN !== "GESTOR") {
    return {
      error:
        "No puedes quitarte tu propio acceso a Administración: quedarías sin forma de recuperarlo. Pídeselo a otro administrador.",
    };
  }

  // Y el último administrador con acceso tampoco puede perderlo, o el sistema
  // se queda sin nadie capaz de conceder permisos.
  if (levels.ADMIN !== "GESTOR") {
    const otros = await prisma.appAccess.count({
      where: { app: "ADMIN", level: "GESTOR", userId: { not: userId }, user: { isActive: true } },
    });
    if (otros === 0) {
      return { error: "Es el único administrador activo: no puedes dejar el sistema sin administración." };
    }
  }

  if (profileId) {
    const exists = await prisma.accessProfile.findUnique({
      where: { id: profileId },
      select: { id: true },
    });
    if (!exists) return { error: "Perfil no encontrado" };
  }

  const entries = Object.entries(levels).filter(([app, level]) => {
    const definition = APP_BY_KEY.get(app as AppKey);
    if (!definition) return false;
    if (!definition.allowedRoles.includes(user.role)) return false;
    return typeof level === "string" && level in LEVEL_ORDER;
  }) as [AppKey, AccessLevel][];

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { profileId } });
    await tx.appAccess.deleteMany({ where: { userId } });
    if (entries.length > 0) {
      await tx.appAccess.createMany({
        data: entries.map(([app, level]) => ({ userId, app, level })),
      });
    }
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath(`/admin/users/${userId}/edit`);
  return { success: true };
}

