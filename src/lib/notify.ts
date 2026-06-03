import { prisma } from "@/lib/prisma";
import { sendGChatNotification } from "@/lib/gchat";
import { dispatchUserWebhooks } from "@/lib/user-webhooks";

/** Crea una notificación sin lanzar errores (fire-and-forget).
 *  Pasa `skipGChat: true` para omitir el webhook (p. ej. proyectos privados). */
export async function notify(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  skipGChat?: boolean
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, type, title, message, link: link ?? null },
    });
  } catch {
    // No bloquear la acción principal
  }
  // Webhook personal del destinatario (solo sus propias notificaciones)
  dispatchUserWebhooks(userId, type, title, message, link).catch(() => {});
  if (!skipGChat) {
    sendGChatNotification(type, title, message, link).catch(() => {});
  }
}

/** Crea notificaciones para varios usuarios evitando duplicados.
 *  Siempre envía el mensaje a Google Chat aunque userIds esté vacío,
 *  salvo que `skipGChat` sea `true` (p. ej. proyectos privados). */
export async function notifyMany(
  userIds: string[],
  type: string,
  title: string,
  message: string,
  link?: string,
  skipGChat?: boolean
): Promise<void> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length > 0) {
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
  // Webhook personal de cada destinatario (solo sus propias notificaciones)
  for (const userId of unique) {
    dispatchUserWebhooks(userId, type, title, message, link).catch(() => {});
  }
  // Una sola vez a GChat independientemente del número de destinatarios
  if (!skipGChat) {
    sendGChatNotification(type, title, message, link).catch(() => {});
  }
}
