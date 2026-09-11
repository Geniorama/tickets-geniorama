/**
 * Núcleo compartido — informes de IA.
 *
 * Aquí vive todo lo que un informe necesita antes de llegar al modelo: acotar
 * un periodo, limpiar el texto de los comentarios y sacar los entregables.
 *
 * El motivo de que el periodo se resuelva aquí y no en el prompt es simple: al
 * modelo no se le puede pedir que ignore lo que ya tiene delante. Si en el
 * bloque de datos van las 120 tareas del proyecto, un «solo habla de la semana
 * del 7 al 9» no basta — las sigue contando. Filtrar antes de construir el
 * contexto es la única forma de que un informe de sprint hable del sprint.
 */

import { fromZonedTime } from "date-fns-tz";

const TZ = "America/Bogota";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Un rango cerrado por ambos extremos, con su etiqueta ya redactada. */
export interface ReportPeriod {
  from: Date;
  to: Date;
  /** «7 al 9 de septiembre de 2026» — para la cabecera y el prompt. */
  label: string;
}

/** Partes de la fecha en Bogotá, no en la zona del servidor. */
function ymdInBogota(d: Date): [number, number, number] {
  const [y, m, day] = d.toLocaleDateString("en-CA", { timeZone: TZ }).split("-");
  return [Number(y), Number(m), Number(day)];
}

function periodLabel(from: Date, to: Date): string {
  const [fy, fm, fd] = ymdInBogota(from);
  const [ty, tm, td] = ymdInBogota(to);

  if (fy === ty && fm === tm && fd === td) return `${fd} de ${MESES[fm - 1]} de ${fy}`;
  if (fy === ty && fm === tm) return `${fd} al ${td} de ${MESES[tm - 1]} de ${ty}`;
  if (fy === ty) return `${fd} de ${MESES[fm - 1]} al ${td} de ${MESES[tm - 1]} de ${ty}`;
  return `${fd} de ${MESES[fm - 1]} de ${fy} al ${td} de ${MESES[tm - 1]} de ${ty}`;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte las dos fechas del formulario («YYYY-MM-DD») en un rango de
 * instantes. Los bordes son medianoche y 23:59:59.999 **de Bogotá**: con la
 * medianoche UTC, un comentario de las 20:00 del viernes se cuenta como del
 * sábado y queda fuera del sprint.
 *
 * Basta con uno de los dos extremos: sin `to` el periodo llega hasta hoy, sin
 * `from` arranca en `fallbackFrom` (normalmente el inicio del proyecto).
 * Devuelve null si no hay ninguno, que es el informe completo de siempre.
 */
export function parseReportPeriod(
  from: string | undefined,
  to: string | undefined,
  fallbackFrom?: Date | null,
): ReportPeriod | null {
  const desde = from && YMD.test(from) ? from : undefined;
  const hasta = to && YMD.test(to) ? to : undefined;
  if (!desde && !hasta) return null;

  let start = desde
    ? fromZonedTime(`${desde}T00:00:00.000`, TZ)
    : (fallbackFrom ?? new Date(0));
  let end = hasta
    ? fromZonedTime(`${hasta}T23:59:59.999`, TZ)
    : new Date();

  // Un rango invertido es un dedazo en el formulario, no un informe vacío.
  if (start > end) [start, end] = [end, start];

  return { from: start, to: end, label: periodLabel(start, end) };
}

export function isWithin(date: Date | null | undefined, period: ReportPeriod): boolean {
  return !!date && date >= period.from && date <= period.to;
}

/**
 * El cuerpo de un comentario tal y como lo leería una persona.
 *
 * Las menciones se guardan como `@[Nombre](userId)`, que es exactamente la
 * sintaxis de un enlace en markdown: sin limpiarlas, el informe acaba con
 * «@Nombre» apuntando a un cuid.
 */
export function plainCommentBody(body: string): string {
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1").trim();
}

/** Recorta un texto largo sin cortar el informe a la mitad de una palabra. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

/** Un archivo o enlace que el equipo dejó en la ficha. */
export interface Deliverable {
  name: string;
  url: string;
}

const URL_RE = /https?:\/\/[^\s<>"'`)\]]+/g;

/**
 * Los enlaces sueltos que alguien pegó en el texto de un comentario.
 *
 * La puntuación final se recorta: «mira https://x.co/y.» termina la frase, no
 * la URL, y un entregable con un punto de más no abre.
 */
export function linksInText(text: string): string[] {
  const found = (text.match(URL_RE) ?? []).map((url) => url.replace(/[.,;:!?»]+$/, ""));
  return [...new Set(found)];
}

/** Quita repetidos por URL conservando el primer nombre que se vio. */
export function dedupeDeliverables(items: Deliverable[]): Deliverable[] {
  const seen = new Map<string, Deliverable>();
  for (const item of items) {
    if (!item.url) continue;
    if (!seen.has(item.url)) seen.set(item.url, item);
  }
  return [...seen.values()];
}

/** «https://drive.google.com/file/d/abc/view» → «drive.google.com» */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "enlace";
  }
}
