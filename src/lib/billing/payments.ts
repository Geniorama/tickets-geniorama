import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { isInvoiced } from "@/lib/billing/status";

/**
 * Los abonos de un cobro.
 *
 * La regla de oro: **el estado se deduce del dinero, no al revés**. Antes se
 * arrastraba la tarjeta a «Abonado» y eso escribía un importe; ahora se apunta
 * el dinero que entró y la columna se coloca sola. Es la única forma de que un
 * cobro con tres pagos parciales no dependa de que alguien se acuerde de
 * mover la tarjeta.
 *
 * Vive fuera de las Server Actions para poder probarlo sin sesión, igual que
 * `move.ts`, y por la misma razón: esto toca dinero.
 */

/** Se factura en pesos: los centavos no existen en la práctica. */
const aPesos = (n: number) => Math.round(n);

/**
 * En qué columna deja al cobro lo que lleva pagado.
 *
 * Solo se pronuncia sobre cobros ya emitidos. Lo que está en backlog o por
 * facturar no tiene abonos —se impide antes— y devolverlo aquí a «Facturado»
 * lo movería solo, que no es lo que nadie espera.
 */
export function estadoSegunPagos(
  status: BillingStatus,
  amount: number,
  totalPagado: number,
): BillingStatus {
  if (!isInvoiced(status)) return status;
  if (totalPagado <= 0) return "FACTURADO";
  // Mayor o igual, no igual: un cliente puede pagar de más por un ajuste o una
  // retención mal aplicada, y eso es un cobro cerrado, no uno a medias.
  if (totalPagado >= amount) return "PAGADO";
  return "ABONADO";
}

/** Lo que falta por entrar. Nunca negativo. */
export function saldo(amount: number, totalPagado: number): number {
  return Math.max(0, aPesos(amount) - aPesos(totalPagado));
}

/**
 * Vuelve a sumar los abonos y coloca el cobro donde le toca.
 *
 * Es el **único** sitio que escribe `paidAmount`. Cualquier cambio en la lista
 * de abonos pasa por aquí; si alguien escribiera esa columna a mano, el
 * siguiente recálculo la corregiría y el cambio se perdería sin avisar.
 */
export async function recalcularPagos(billingItemId: string) {
  const cobro = await prisma.billingItem.findUnique({
    where: { id: billingItemId },
    select: { amount: true, status: true, invoicedAt: true },
  });
  if (!cobro) return;

  const pagos = await prisma.billingPayment.findMany({
    where: { billingItemId },
    orderBy: { paidOn: "desc" },
    select: { amount: true, paidOn: true },
  });

  const total = aPesos(pagos.reduce((s, p) => s + p.amount, 0));
  const status = estadoSegunPagos(cobro.status, cobro.amount, total);

  await prisma.billingItem.update({
    where: { id: billingItemId },
    data: {
      paidAmount: total,
      status,
      // La fecha de pago es la del último abono, no la de hoy: si se apunta en
      // octubre un pago que entró en septiembre, el cobro es de septiembre.
      paidAt: status === "PAGADO" ? (pagos[0]?.paidOn ?? new Date()) : null,
      // Apuntar un pago sobre algo sin fecha de emisión la deja puesta: si
      // entró dinero, la factura existía.
      invoicedAt: cobro.invoicedAt ?? (total > 0 ? new Date() : null),
    },
  });
}

export type ResultadoPago = { ok: true; id: string } | { ok: false; error: string };

export async function registrarPago(
  billingItemId: string,
  datos: { amount: number; paidOn: Date; method?: string | null; note?: string | null },
  registeredById: string,
): Promise<ResultadoPago> {
  if (!(datos.amount > 0)) return { ok: false, error: "El abono tiene que ser mayor que cero" };

  const cobro = await prisma.billingItem.findUnique({
    where: { id: billingItemId },
    select: { status: true },
  });
  if (!cobro) return { ok: false, error: "Cobro no encontrado" };

  // Cobrar algo que todavía no se ha facturado es cobrar lo que el cliente no
  // ha recibido. Si de verdad entró un anticipo, primero se emite la factura.
  if (!isInvoiced(cobro.status)) {
    return { ok: false, error: "Primero pasa el cobro a «Facturado»: no se apunta un pago de algo sin facturar" };
  }

  const pago = await prisma.billingPayment.create({
    data: {
      billingItemId,
      amount: aPesos(datos.amount),
      paidOn: datos.paidOn,
      method: datos.method?.trim() || null,
      note: datos.note?.trim() || null,
      registeredById,
    },
    select: { id: true },
  });

  await recalcularPagos(billingItemId);
  return { ok: true, id: pago.id };
}

export async function borrarPago(pagoId: string, billingItemId: string): Promise<ResultadoPago> {
  // Acotado al cobro: un id suelto no puede borrar el abono de otra factura.
  const { count } = await prisma.billingPayment.deleteMany({
    where: { id: pagoId, billingItemId },
  });
  if (count === 0) return { ok: false, error: "Ese abono no existe en este cobro" };

  await recalcularPagos(billingItemId);
  return { ok: true, id: pagoId };
}
