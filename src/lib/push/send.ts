/**
 * Envío de notificaciones push.
 *
 * Va enganchado a `notify()`, así que **cualquier aviso que ya existía llega
 * también al dispositivo** sin tocar quien lo dispara: una asignación, una
 * mención, un vencimiento. No hay un catálogo aparte de «avisos push» que
 * mantener en paralelo.
 *
 * Tres reglas:
 *
 *   · **Nunca lanza.** Un push que falla no puede tumbar la acción que lo
 *     provocó, igual que los hooks. Asignar una tarea no depende de que el
 *     móvil de alguien esté accesible.
 *   · **No cuesta si no hay a quién.** Si no hay claves configuradas o la
 *     persona no tiene dispositivos, se sale antes de tocar la base.
 *   · **Se limpia sola.** Cuando el servicio de push contesta que el endpoint
 *     ya no existe (404/410), la suscripción se borra. Si no, la tabla se
 *     llena de navegadores que ya nadie usa y cada aviso paga por ellos.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT, isPushConfigured } from "@/lib/push/config";

let configurado = false;

function prepara(): boolean {
  if (!isPushConfigured()) return false;
  if (!configurado) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configurado = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** A dónde lleva al pulsar. Relativa a la app. */
  url?: string | null;
  /**
   * Agrupa avisos del mismo asunto: uno nuevo del mismo `tag` reemplaza al
   * anterior en vez de apilarse. Sin esto, diez comentarios son diez avisos.
   */
  tag?: string;
};

/** Manda un aviso a todos los dispositivos de una persona. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    if (!prepara()) return;

    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return;

    const cuerpo = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard",
      tag: payload.tag ?? "geniorama",
    });

    const muertas: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            cuerpo,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          // 404 y 410 significan «este dispositivo ya no está»: no es un fallo
          // que reintentar, es una suscripción que sobra.
          if (status === 404 || status === 410) muertas.push(sub.id);
          else console.error("[push] Error enviando:", status, (err as Error).message);
        }
      }),
    );

    if (muertas.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: muertas } } }).catch(() => {});
    } else {
      await prisma.pushSubscription
        .updateMany({ where: { userId }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    }
  } catch (err) {
    console.error("[push] Error inesperado:", err);
  }
}

/** Igual, para varios destinatarios a la vez. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unicos = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unicos.map((id) => sendPushToUser(id, payload)));
}
