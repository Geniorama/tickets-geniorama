import { toZonedTime, format } from "date-fns-tz";
import { es } from "date-fns/locale";

const TZ = "America/Bogota";

/** dd/MM/yyyy HH:mm — p.ej. 09/03/2026 14:35 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(toZonedTime(d, TZ), "dd/MM/yyyy HH:mm", { locale: es, timeZone: TZ });
}

/** dd MMM yyyy, HH:mm — p.ej. 09 mar 2026, 14:35 */
export function formatDateTimeLong(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(toZonedTime(d, TZ), "dd MMM yyyy, HH:mm", { locale: es, timeZone: TZ });
}

/** dd/MM/yyyy — solo fecha (usa partes UTC para evitar desfase en fechas sin hora) */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
