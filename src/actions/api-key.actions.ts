"use server";

/**
 * Administración de las llaves de la API.
 *
 * Crear una llave es delegar en un sistema externo la capacidad de escribir en
 * nombre de alguien, así que es cosa de la administración y solo de ella.
 *
 * El token se devuelve **una única vez**, en la respuesta de `createApiKey`. Ni
 * se guarda en claro ni hay forma de volver a verlo: si se pierde, se revoca y
 * se crea otra. Es incómodo a propósito — la alternativa es una tabla llena de
 * credenciales en claro.
 */

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { generateToken } from "@/lib/api/keys";
import { API_SCOPES, displayPrefix, isApiScope } from "@/lib/api/scopes";

export type ApiKeyItem = {
  id: string;
  label: string;
  prefix: string;
  scopes: string[];
  isActive: boolean;
  expiresAt: Date | null;
  /** Se resuelve en el servidor: el reloj del navegador no decide esto. */
  isExpired: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  user: { id: string; name: string; email: string };
};

const MAX_KEYS = 20;

const keySchema = z.object({
  label: z.string().trim().min(1, "Ponle un nombre a la llave").max(80),
  userId: z.string().min(1, "Elige en nombre de quién escribe la llave"),
  scopes: z.array(z.string()).min(1, "Selecciona al menos un permiso"),
  expiresAt: z.string().trim().optional(),
});

export async function getApiKeys(): Promise<ApiKeyItem[]> {
  await requireCan("ADMIN", "gestionar");
  const now = Date.now();
  const rows = await prisma.apiKey.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      label: true,
      prefix: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      lastUsedAt: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    ...row,
    isExpired: row.expiresAt !== null && row.expiresAt.getTime() < now,
  }));
}

/** Usuarios a los que se puede atar una llave. */
export async function getApiKeyCandidates(): Promise<{ id: string; name: string; email: string; role: string }[]> {
  await requireCan("ADMIN", "gestionar");
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}

export async function createApiKey(input: {
  label: string;
  userId: string;
  scopes: string[];
  expiresAt?: string;
}): Promise<{ error?: string; token?: string; prefix?: string }> {
  const session = await requireCan("ADMIN", "gestionar");

  const parsed = keySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const scopes = [...new Set(parsed.data.scopes)].filter(isApiScope);
  if (scopes.length === 0) {
    return { error: `Permisos válidos: ${API_SCOPES.join(", ")}` };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId, isActive: true },
    select: { id: true },
  });
  if (!user) return { error: "Ese usuario no existe o está inactivo" };

  const count = await prisma.apiKey.count();
  if (count >= MAX_KEYS) {
    return { error: `Máximo ${MAX_KEYS} llaves. Elimina alguna antes de crear otra.` };
  }

  let expiresAt: Date | null = null;
  if (parsed.data.expiresAt) {
    const parsedDate = new Date(parsed.data.expiresAt);
    if (Number.isNaN(parsedDate.getTime())) return { error: "La fecha de vencimiento no es válida" };
    if (parsedDate.getTime() < Date.now()) return { error: "La fecha de vencimiento ya pasó" };
    expiresAt = parsedDate;
  }

  const { token, prefix, tokenHash } = generateToken();

  try {
    await prisma.apiKey.create({
      data: {
        label: parsed.data.label,
        prefix,
        tokenHash,
        scopes,
        expiresAt,
        userId: parsed.data.userId,
        createdById: session.user.id,
      },
    });
  } catch {
    return { error: "No se pudo crear la llave" };
  }

  revalidatePath("/admin/integraciones");
  return { token, prefix: displayPrefix(prefix) };
}

/**
 * Revocar deja la fila y corta el acceso; borrar la quita del todo.
 *
 * Se ofrecen las dos porque no son lo mismo: revocada, la llave sigue contando
 * quién la creó y cuándo se usó por última vez —útil cuando se sospecha de una
 * filtración—; borrada, esa pista desaparece.
 */
export async function revokeApiKey(keyId: string): Promise<{ error?: string }> {
  await requireCan("ADMIN", "gestionar");
  await prisma.apiKey.update({ where: { id: keyId }, data: { isActive: false } }).catch(() => null);
  revalidatePath("/admin/integraciones");
  return {};
}

export async function deleteApiKey(keyId: string): Promise<{ error?: string }> {
  await requireCan("ADMIN", "gestionar");
  await prisma.apiKey.delete({ where: { id: keyId } }).catch(() => null);
  revalidatePath("/admin/integraciones");
  return {};
}
