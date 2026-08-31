import type { BillingStatus } from "@/generated/prisma";

/**
 * El tablero de facturación: las mismas listas que había en Trello.
 *
 * El orden es el del dinero, no el del tablero antiguo: **Backlog va primero**
 * porque es lo que todavía no toca, y a la derecha está lo cobrado. En Trello
 * estaba al final; si estorba ahí, cambiar el orden es una línea.
 */

export const BILLING_STATUSES: BillingStatus[] = [
  "BACKLOG",
  "POR_FACTURAR",
  "FACTURADO",
  "ABONADO",
  "PAGADO",
];

export const BILLING_STATUS_LABELS: Record<BillingStatus, string> = {
  BACKLOG:      "Backlog",
  POR_FACTURAR: "Por facturar",
  FACTURADO:    "Facturado",
  ABONADO:      "Abonado",
  PAGADO:       "Pagado",
};

export const BILLING_STATUS_DESCRIPTIONS: Record<BillingStatus, string> = {
  BACKLOG:      "Previsto, pero todavía no toca facturarlo.",
  POR_FACTURAR: "Listo para emitir la factura.",
  FACTURADO:    "Factura emitida, pendiente de cobro.",
  ABONADO:      "Entró una parte del dinero, falta el resto.",
  PAGADO:       "Cobrado por completo.",
};

/** De frío a cobrado. El abonado es ámbar: hay dinero, pero no todo. */
export const BILLING_STATUS_COLORS: Record<BillingStatus, string> = {
  BACKLOG:      "#64748b",
  POR_FACTURAR: "#3b82f6",
  FACTURADO:    "#8b5cf6",
  ABONADO:      "#f59e0b",
  PAGADO:       "#22c55e",
};

/** Lo que sigue pendiente de cobrar: todo menos lo pagado. */
export const OPEN_BILLING_STATUSES: BillingStatus[] = BILLING_STATUSES.filter((s) => s !== "PAGADO");

/** Lo que ya se emitió y por tanto tiene número de factura y fecha. */
export const INVOICED_STATUSES: BillingStatus[] = ["FACTURADO", "ABONADO", "PAGADO"];

export const isInvoiced = (s: BillingStatus) => INVOICED_STATUSES.includes(s);

/**
 * Cuánto falta por cobrar de un cobro concreto.
 *
 * Nunca negativo: si alguien abonó de más —pasa, con retenciones y ajustes—,
 * el saldo es cero y no un número en rojo que no significa nada.
 */
export function pendiente(amount: number, paidAmount: number): number {
  return Math.max(0, amount - paidAmount);
}
