"use server";

import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push/send";
import { isPushConfigured } from "@/lib/push/config";

/**
 * Alta y baja de un dispositivo en las notificaciones push.
 *
 * La suscripción va siempre atada a **quien tiene la sesión**, nunca a un id
 * que llegue del cliente: si no, cualquiera podría suscribir el navegador de
 * otro y leer sus avisos.
 */

export async function subscribeToPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const session = await getRequiredSession();

  if (!input.endpoint || !input.p256dh || !input.auth) {
    return { error: "La suscripción del navegador está incompleta" };
  }

  // El endpoint es único por dispositivo. Si ya existía —el navegador la
  // renovó, o la persona cambió de cuenta en el mismo equipo— se reasigna a
  // quien está usando la sesión ahora, que es lo que evita que un dispositivo
  // siga recibiendo los avisos del usuario anterior.
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      userId: session.user.id,
    },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      userId: session.user.id,
    },
  });

  return { success: true };
}

export async function unsubscribeFromPush(endpoint: string) {
  const session = await getRequiredSession();

  // Acotado al dueño: un endpoint suelto no puede desactivar el de otro.
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: session.user.id },
  });

  return { success: true };
}

/**
 * Un aviso de prueba al propio dispositivo.
 *
 * Activar notificaciones y no ver nunca ninguna deja la duda de si funcionó.
 * Esto la resuelve en el momento, y solo se envía a quien lo pide.
 */
export async function sendTestPush() {
  const session = await getRequiredSession();

  if (!isPushConfigured()) {
    return { error: "Las notificaciones push no están configuradas en el servidor" };
  }

  const dispositivos = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
  if (dispositivos === 0) {
    return { error: "No hay ningún dispositivo activado" };
  }

  const r = await sendPushToUser(session.user.id, {
    title: "Notificaciones activadas",
    body: "Así se verán los avisos de Geniorama en este dispositivo.",
    url: "/dashboard",
    tag: "prueba",
  });

  // Se cuenta lo que pasó de verdad. Decir «Enviado» cuando el servicio de
  // push rechazó los tres dispositivos deja al que lo prueba sin saber si el
  // problema es el servidor, el navegador o el sistema operativo.
  if (r.enviados === 0) {
    const detalle = r.errores[0] ? ` (${r.errores[0]})` : "";
    return {
      error:
        r.borradas > 0 && r.fallidos === 0
          ? "El navegador ya no acepta este dispositivo. Desactiva y vuelve a activar."
          : `Ningún dispositivo aceptó el aviso${detalle}`,
    };
  }

  return {
    success: true,
    enviados: r.enviados,
    fallidos: r.fallidos,
  };
}
