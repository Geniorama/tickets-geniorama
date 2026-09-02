/**
 * Mover un cobro de estado, con el dinero y las fechas cuadrando.
 *
 * Vive fuera de la Server Action para poder probarlo: aquella arranca pidiendo
 * sesión y no se deja llamar desde un script. Es la misma separación que se
 * hizo con el acceso al portal, y por la misma razón — esto toca dinero.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";
import { BILLING_STATUSES, BILLING_STATUS_LABELS, isInvoiced } from "@/lib/billing/status";
import { recalcularPagos } from "@/lib/billing/payments";

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
  opciones: { ahora?: Date } = {},
): Sellos {
  const ahora = opciones.ahora ?? new Date();

  if (status === "PAGADO") {
    return {
      // Pagado es pagado: lo abonado iguala al importe, sin dejar céntimos
      // sueltos que después aparecen como saldo pendiente. Quien mueve la
      // tarjeta aquí genera además el abono que cubre lo que faltaba, para que
      // la lista de pagos y esta cifra digan lo mismo.
      paidAmount: actual.amount,
      invoicedAt: actual.invoicedAt ?? ahora,
      paidAt: actual.paidAt ?? ahora,
    };
  }

  if (status === "ABONADO") {
    // Ya no se escribe un importe aquí: lo abonado es la suma de los abonos y
    // solo lo toca `recalcularPagos`. Este estado se limita a conservar lo que
    // haya.
    return {
      paidAmount: actual.paidAmount,
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

/**
 * Mueve un cobro de columna.
 *
 * Con abonos registrados, mover hacia atrás dejaría huérfanos unos pagos que
 * el cobro dice no tener. Antes esto ponía `paidAmount` a cero y el dinero
 * desaparecía en silencio; ahora se para y se explica, porque borrar el rastro
 * de un pago no es mover una tarjeta.
 *
 * Al soltar en «Pagado» se apunta el abono que faltaba: si alguien afirma que
 * está cobrado, ese dinero entró y tiene que constar como tal.
 */
export async function moveBillingStatus(
  id: string,
  status: BillingStatus,
  actor: { id: string; name?: string | null },
): Promise<MoveResult> {
  if (!BILLING_STATUSES.includes(status)) return { ok: false, error: "Estado no válido" };

  const actual = await prisma.billingItem.findUnique({
    where: { id },
    select: {
      amount: true, paidAmount: true, invoicedAt: true, paidAt: true, invoiceNumber: true,
      // El estado previo es lo que el historial necesita para decir de dónde
      // salió la tarjeta.
      status: true,
      _count: { select: { payments: true } },
    },
  });
  if (!actual) return { ok: false, error: "Cobro no encontrado" };

  const tienePagos = actual._count.payments > 0;

  if (tienePagos && status !== "PAGADO" && status !== "ABONADO") {
    return {
      ok: false,
      error: `Este cobro tiene ${actual._count.payments} ${actual._count.payments === 1 ? "abono registrado" : "abonos registrados"}. Quítalos antes de devolverlo a «${BILLING_STATUS_LABELS[status]}».`,
    };
  }

  // Soltar en «Pagado» con saldo pendiente: se registra ese saldo como abono.
  if (status === "PAGADO") {
    const falta = Math.max(0, Math.round(actual.amount) - Math.round(actual.paidAmount));
    if (falta > 0) {
      await prisma.billingPayment.create({
        data: {
          billingItemId: id, amount: falta, paidOn: new Date(),
          note: "Registrado al marcar el cobro como pagado.",
          registeredById: actor.id,
        },
      });
    }
  }

  await prisma.billingItem.update({
    where: { id },
    data: {
      status,
      // Al volver antes de «Facturado», el número de factura deja de aplicar.
      invoiceNumber: isInvoiced(status) ? actual.invoiceNumber : null,
      ...sellosPara(status, actual),
    },
  });

  // Deja `paidAmount`, el estado y las fechas cuadrados con la lista de abonos.
  if (isInvoiced(status)) await recalcularPagos(id);

  // El historial se escribe aquí y no en la Server Action porque este es el
  // único camino por el que un cobro cambia de columna: el tablero, la ficha y
  // lo que venga después pasan todos por aquí.
  if (actual.status !== status) {
    recordActivity({
      entityType: "BILLING",
      entityId: id,
      action: "billing.status_changed",
      label: await entityLabel("BILLING", id),
      changes: { status: { from: actual.status, to: status } },
      actor,
    });
  }

  return { ok: true };
}
