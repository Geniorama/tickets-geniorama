/**
 * Informes mensuales del cliente (AG·P-5).
 *
 * Un informe es un adjunto de ticket con `reportMonth = "YYYY-MM"`. Aquí viven
 * las reglas que comparten el aviso, la subida y la página «Informes».
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** «2026-10» si es un mes válido; null si no. */
export function parseReportMonth(value: unknown): string | null {
  return typeof value === "string" && MONTH_RE.test(value) ? value : null;
}

/** «2026-10» → «octubre de 2026». */
export function reportMonthLabel(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  return `${MONTH_NAMES[Number(m[2]) - 1]} de ${m[1]}`;
}

/** Mes actual en hora de Colombia, como «YYYY-MM». */
export function currentMonthKey(now: Date = new Date()): string {
  const bogota = new Date(now.getTime() - 5 * 3600_000);
  return `${bogota.getUTCFullYear()}-${String(bogota.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mes anterior a uno dado. */
function previousMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Los meses que se muestran al cliente, del más reciente al más antiguo.
 *
 * Arrancan en el mes del primer informe que ha recibido y llegan hasta el
 * último mes completo —o el actual, si ya tiene su informe—. Así un cliente
 * que nunca ha recibido informes no ve una lista de «pendientes» que no le
 * corresponde, y el mes en curso no figura como atrasado antes de acabar.
 */
export function monthsToShow(published: string[], now: Date = new Date()): string[] {
  if (published.length === 0) return [];
  const first = [...published].sort()[0];
  const current = currentMonthKey(now);
  const last = published.includes(current) ? current : previousMonth(current);

  const months: string[] = [];
  for (let m = last; m >= first; m = previousMonth(m)) {
    months.push(m);
    if (months.length > 36) break;
  }
  return months;
}
