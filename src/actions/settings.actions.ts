"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export type SettingsMap = Record<string, string>;

export async function getSettings(keys: string[]): Promise<SettingsMap> {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: keys } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function saveSetting(key: string, value: string): Promise<{ error?: string }> {
  await requireRole(["ADMINISTRADOR"]);
  try {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudo guardar la configuración." };
  }
}

export async function deleteSetting(key: string): Promise<{ error?: string }> {
  await requireRole(["ADMINISTRADOR"]);
  try {
    await prisma.appSetting.deleteMany({ where: { key } });
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudo eliminar la configuración." };
  }
}
