import { prisma } from "@/lib/prisma";

/** Crea una notificación sin lanzar errores (fire-and-forget). */
export async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link: link ?? null },
    });
  } catch {
    // No bloquear la acción principal
  }
}

/** Crea notificaciones para varios usuarios evitando duplicados. */
export async function notifyMany(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  try {
    await prisma.notification.createMany({
      data: unique.map((userId) => ({
        userId,
        type,
        title,
        message,
        link: link ?? null,
      })),
    });
  } catch {
    // No bloquear la acción principal
  }
}
