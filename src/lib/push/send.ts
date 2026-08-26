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
 *
 * Devuelve el resultado en vez de tragárselo. `notify()` lo ignora —es
 * fire-and-forget—, pero el botón de prueba lo enseña: un «Enviado» que sale
 * aunque hayan fallado los tres dispositivos no sirve para diagnosticar nada,
 * que es justo lo que hacía falta cuando esto no funcionaba.
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

export type PushResult = {
  /** Dispositivos que aceptaron el aviso. */
  enviados: number;
  /** Los que lo rechazaron por algo que no es «ya no existo». */
  fallidos: number;
  /** Suscripciones muertas que se borraron por el camino. */
  borradas: number;
  /** Qué contestaron los que fallaron, para poder enseñarlo. */
  errores: string[];
  /** Sin claves configuradas en el servidor. */
  sinConfigurar?: boolean;
};

const VACIO: PushResult = { enviados: 0, fallidos: 0, borradas: 0, errores: [] };

/** Manda un aviso a todos los dispositivos de una persona. */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  try {
    if (!prepara()) return { ...VACIO, sinConfigurar: true };

    const subs = await prisma.pushSubscription.findMany({
      where: { userId },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (subs.length === 0) return { ...VACIO };

    const cuerpo = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard",
      tag: payload.tag ?? "geniorama",
    });

    const muertas: string[] = [];
    const vivas: string[] = [];
    const errores: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            cuerpo,
          );
          vivas.push(sub.id);
        } catch (err) {
          const e = err as { statusCode?: number; body?: string; message?: string };
          // 404 y 410 significan «este dispositivo ya no está»: no es un fallo
          // que reintentar, es una suscripción que sobra.
          if (e.statusCode === 404 || e.statusCode === 410) {
            muertas.push(sub.id);
            return;
          }
          // El cuerpo de la respuesta es lo que de verdad dice qué pasó
          // —«invalid JWT», «key does not match»—; el código solo, no.
          const detalle = [e.statusCode, (e.body || e.message || "").trim()]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 300);
          errores.push(detalle || "Error desconocido");
          console.error("[push] Error enviando:", detalle);
        }
      }),
    );

    if (muertas.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: muertas } } }).catch(() => {});
    }
    // Solo se marcan como usadas las que de verdad aceptaron el aviso. Antes se
    // marcaban todas, así que la tabla decía «entregado» aunque no llegara nada.
    if (vivas.length > 0) {
      await prisma.pushSubscription
        .updateMany({ where: { id: { in: vivas } }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
    }

    return { enviados: vivas.length, fallidos: errores.length, borradas: muertas.length, errores };
  } catch (err) {
    console.error("[push] Error inesperado:", err);
    return { ...VACIO, fallidos: 1, errores: [err instanceof Error ? err.message : "Error inesperado"] };
  }
}

/** Igual, para varios destinatarios a la vez. */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  const unicos = [...new Set(userIds)].filter(Boolean);
  await Promise.all(unicos.map((id) => sendPushToUser(id, payload)));
}
