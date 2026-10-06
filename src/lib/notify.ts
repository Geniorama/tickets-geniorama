import { prisma } from "@/lib/prisma";
import { sendGChatNotification } from "@/lib/gchat";
import { dispatchUserWebhooks } from "@/lib/user-webhooks";
import { sendPushToUser, sendPushToUsers } from "@/lib/push/send";
import { dispatchTicketAgentAssigned, dispatchWhatsApp } from "@/lib/whatsapp/send";

/**
 * WhatsApp, para quien lo activó y solo en los tipos que tienen plantilla (ver
 * lib/whatsapp). Va aquí por lo mismo que el push: cualquier aviso que ya
 * existía llega sin tocar el sitio que lo emite.
 *
 * Asignar un ticket a un agente avisa además a su cliente. Se deduce aquí del
 * enlace porque la asignación ocurre en media docena de sitios (formulario,
 * tablero, API, MCP, recurrentes) y todos pasan por este aviso.
 */
function viaWhatsApp(userIds: string[], type: string, message: string, link?: string) {
  void dispatchWhatsApp(userIds, type, message, link);
  if (type === "ticket_assigned" && userIds.length === 1) {
    const ticketId = /^\/tickets\/([^/?#]+)$/.exec(link ?? "")?.[1];
    if (ticketId) void dispatchTicketAgentAssigned(ticketId, userIds[0]);
  }
}

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
  // Y al dispositivo, si lo activó. Va aquí y no en cada sitio que avisa: así
  // cualquier notificación que ya existía llega al móvil sin tocar nada más.
  sendPushToUser(userId, { title, body: message, url: link, tag: type }).catch(() => {});
  viaWhatsApp([userId], type, message, link);
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
  sendPushToUsers(unique, { title, body: message, url: link, tag: type }).catch(() => {});
  viaWhatsApp(unique, type, message, link);
  // Una sola vez a GChat independientemente del número de destinatarios
  if (!skipGChat) {
    sendGChatNotification(type, title, message, link).catch(() => {});
  }
}
