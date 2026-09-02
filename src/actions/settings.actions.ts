"use server";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity/record";
import { PLATFORM_SCOPE } from "@/lib/activity/catalog";

export type SettingsMap = Record<string, string>;

export async function getSettings(keys: string[]): Promise<SettingsMap> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Solo la clave, nunca el valor.
 *
 * Aquí viven las credenciales de las integraciones —Xubio, entre otras—, así
 * que el historial dice qué ajuste se tocó y quién, y ni una letra de lo que se
 * guardó. Una bitácora que copia secretos es una filtración con fecha.
 */
function apuntarAjuste(key: string, nota: string, actor: { id: string; name?: string | null }) {
  recordActivity({
    entityType: "SETTINGS",
    entityId: PLATFORM_SCOPE,
    action: "settings.updated",
    label: key,
    meta: { note: nota },
    actor,
  });
}

export async function saveSetting(key: string, value: string): Promise<{ error?: string }> {
  const session = await requireCan("ADMIN");
  try {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    apuntarAjuste(key, "Se le dio un valor nuevo.", session.user);
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudo guardar la configuración." };
  }
}

export async function deleteSetting(key: string): Promise<{ error?: string }> {
  const session = await requireCan("ADMIN");
  try {
    const { count } = await prisma.appSetting.deleteMany({ where: { key } });
    if (count > 0) apuntarAjuste(key, "Se borró el ajuste.", session.user);
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudo eliminar la configuración." };
  }
}
