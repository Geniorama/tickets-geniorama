/**
 * Mover un cobro de estado, con el dinero y las fechas cuadrando.
 *
 * Vive fuera de la Server Action para poder probarlo: aquella arranca pidiendo
 * sesión y no se deja llamar desde un script. Es la misma separación que se
 * hizo con el acceso al portal, y por la misma razón — esto toca dinero.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUSES, isInvoiced } from "@/lib/billing/status";

export type Sellos = {
  paidAmount: number;
  invoicedAt: Date | null;
  paidAt: Date | null;
};

/**
 * Qué dinero y qué fechas corresponden a un estado.
 *
 * Es el corazón del módulo. Un cobro va hacia adelante y hacia atrás —una
 * factura se anula, un pago se devuelve—, así que cada sello se pone al entrar
 * en su estado y **se quita al salir**. Si no, quedan cobros «por facturar» con
 * número de factura y fecha de pago, que es justo el tipo de dato que hace que
 * nadie vuelva a fiarse del tablero.
 *
 * Es pura a propósito: sin `prisma` ni `Date.now()` escondidos, se puede
 * comprobar caso por caso.
 */
export function sellosPara(
  status: BillingStatus,
  actual: { amount: number; paidAmount: number; invoicedAt: Date | null; paidAt: Date | null },
  opciones: { abono?: number | null; ahora?: Date } = {},
): Sellos {
  const ahora = opciones.ahora ?? new Date();

  if (status === "PAGADO") {
    return {
      // Pagado es pagado: lo abonado iguala al importe, sin dejar céntimos
      // sueltos que después aparecen como saldo pendiente.
      paidAmount: actual.amount,
      invoicedAt: actual.invoicedAt ?? ahora,
      paidAt: actual.paidAt ?? ahora,
    };
  }

  if (status === "ABONADO") {
    // Sin monto se conserva lo que ya hubiera. Nunca más que el total: eso
    // sería un pago completo, no un abono.
    const bruto = opciones.abono ?? actual.paidAmount;
    return {
      paidAmount: Math.min(Math.max(0, bruto), actual.amount),
      invoicedAt: actual.invoicedAt ?? ahora,
      paidAt: null,
    };
  }

  if (status === "FACTURADO") {
    return { paidAmount: 0, invoicedAt: actual.invoicedAt ?? ahora, paidAt: null };
  }

  // Backlog y Por facturar: todavía no se emitió nada ni entró nada.
  return { paidAmount: 0, invoicedAt: null, paidAt: null };
}

export type MoveResult = { ok: true } | { ok: false; error: string };

export async function moveBillingStatus(
  id: string,
  status: BillingStatus,
  abono?: number | null,
): Promise<MoveResult> {
  if (!BILLING_STATUSES.includes(status)) return { ok: false, error: "Estado no válido" };

  const actual = await prisma.billingItem.findUnique({
    where: { id },
    select: { amount: true, paidAmount: true, invoicedAt: true, paidAt: true, invoiceNumber: true },
  });
  if (!actual) return { ok: false, error: "Cobro no encontrado" };

  await prisma.billingItem.update({
    where: { id },
    data: {
      status,
      // Al volver antes de «Facturado», el número de factura deja de aplicar.
      invoiceNumber: isInvoiced(status) ? actual.invoiceNumber : null,
      ...sellosPara(status, actual, { abono }),
    },
  });

  return { ok: true };
}
