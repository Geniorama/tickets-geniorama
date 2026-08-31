/**
 * Importes, escritos igual en toda la app.
 *
 * Vivía dentro del CRM porque allí nació. Al llegar Facturación habría hecho
 * falta una segunda copia, y dos formateadores de dinero acaban discrepando en
 * los decimales justo cuando alguien compara una oportunidad con su cobro.
 */

/**
 * Sin decimales: en una propuesta o una factura los centavos son ruido, y la
 * columna de un tablero es estrecha.
 */
export function formatAmount(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Lo que la gente teclea en un campo de dinero: con puntos de miles, con signo
 * de peso, con espacios. Devuelve `null` si no hay nada aprovechable.
 */
export function parseAmount(raw: unknown): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
