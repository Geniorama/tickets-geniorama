"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import type { AccessLevel, AppKey } from "@/generated/prisma";
import { APP_BY_KEY, LEVEL_ORDER } from "@/lib/access/apps";
import { recordActivity } from "@/lib/activity/record";

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
  const session = await requireCan("ADMIN");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true },
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

  // Los permisos se guardan enteros de una vez, así que el historial guarda la
  // concesión resultante y no campo a campo: «TICKETS: GESTOR, CRM: LECTURA».
  // Es lo que hay que poder leer meses después para saber qué se le dio a quién.
  const antesNiveles = await prisma.appAccess
    .findMany({ where: { userId }, select: { app: true, level: true } })
    .catch(() => []);
  const resumir = (rows: { app: string; level: string }[]) =>
    rows
      .filter((r) => r.level !== "SIN_ACCESO")
      .map((r) => `${r.app}: ${r.level}`)
      .sort();

  recordActivity({
    entityType: "USER",
    entityId: userId,
    action: "user.access_changed",
    label: user.name,
    changes: {
      access: {
        from: resumir(antesNiveles),
        to: resumir(entries.map(([app, level]) => ({ app, level }))),
      },
    },
    actor: session.user,
  });

  revalidatePath(`/admin/users/${userId}`);
  revalidatePath(`/admin/users/${userId}/edit`);
  return { success: true };
}

