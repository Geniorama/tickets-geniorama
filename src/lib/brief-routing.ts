import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";

const TZ = "America/Bogota";

/** "HH:MM" en 24 h. */
export const DUE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Suma días hábiles a una fecha "YYYY-MM-DD", saltando sábados y domingos.
 *
 * Trabaja sobre `Date.UTC` a propósito: así la aritmética no depende de la zona
 * del servidor ni la altera un cambio de horario de verano. La cadena entra y
 * sale en el mismo formato, sin instantes de por medio.
 *
 * No contempla festivos de Colombia — un brief que caiga junto a uno vencerá un
 * día antes de lo que diría el calendario laboral real.
 */
export function addBusinessDays(fromYmd: string, days: number): string {
  const [y, m, d] = fromYmd.split("-").map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));

  let remaining = Math.max(0, days);
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining--;
  }

  return cursor.toISOString().slice(0, 10);
}

/**
 * Fecha límite de una tarea creada desde un brief, a `dueDays` días hábiles.
 *
 * Devuelve la medianoche de Bogotá como instante UTC, que es como el resto de
 * la app guarda `dueDate` (ver el cron de vencidas). La hora del día no va
 * aquí: viaja aparte en `Task.endTime`.
 */
export function resolveBriefDueDate(dueDays: number, now: Date = new Date()): Date {
  // El "hoy" tiene que ser el de Bogotá: un brief que entra a las 22:00 hora
  // local ya es el día siguiente en UTC, y contaría un día hábil de menos.
  const todayInBogota = now.toLocaleDateString("en-CA", { timeZone: TZ });
  return fromZonedTime(`${addBusinessDays(todayInBogota, dueDays)}T00:00:00`, TZ);
}

/**
 * Normaliza el `briefType` que manda n8n.
 *
 * Vive aquí y no en las Server Actions porque el webhook
 * (`/api/integrations/brief`) también la usa, y un módulo `"use server"` solo
 * puede exportar funciones async. Al aplicarla en ambos lados, "Sitio Web" en
 * la pantalla de administración y "sitio web" en el payload son la misma regla.
 */
export function normalizeBriefType(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Lectores de la pantalla de administración.
 *
 * Viven aquí y no en las Server Actions porque la página los invoca **durante
 * el render**, y ese fue justo el fallo de la v1.50.2: un `"use server"` usado
 * como cargador de datos redirigía al dashboard. Los Server Actions quedan solo
 * para las mutaciones que llama el cliente. La página ya se guarda con
 * `requireCan("ADMIN")`.
 */
export async function listBriefRoutings() {
  return prisma.briefRouting.findMany({
    orderBy: { label: "asc" },
    include: {
      assignedTo: { select: { id: true, name: true, email: true, isActive: true } },
    },
  });
}

/** Staff disponible para asignar (alimenta el <select> de la pantalla). */
export async function listAssignableStaff() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });
}
