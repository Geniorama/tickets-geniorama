/**
 * Anular una factura o una cuenta de cobro.
 *
 * El documento se va al cementerio (`billing_voids`) con lo que decía el día en
 * que se anuló. El cobro toma uno de dos caminos, que elige quien anula:
 * vuelve a «Por facturar» para reemitirse, o se da de baja.
 *
 * Vive fuera de la Server Action por lo mismo que `move.ts`: esto toca dinero y
 * tiene que poder probarse sin sesión.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { isInvoiced } from "@/lib/billing/status";
import { DOC_TYPE_LABELS } from "@/lib/billing/doc-type";
import { recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";
import { avisarFacturacion } from "@/lib/billing/notify";

/**
 * Por qué no se puede anular, o `null` si sí se puede.
 *
 * Con abonos no: anular dejaría dinero recibido contra un documento que ya no
 * existe. Misma regla que al devolver una tarjeta en el tablero.
 */
export function bloqueoDeAnulacion(status: BillingStatus, abonos: number): string | null {
  if (status === "ANULADO") return "Este cobro ya está anulado.";
  if (!isInvoiced(status)) return "Solo se anula lo ya facturado.";
  if (abonos > 0) {
    return `Este cobro tiene ${abonos} ${abonos === 1 ? "abono registrado" : "abonos registrados"}. Quítalos antes de anularlo.`;
  }
  return null;
}

export type ResultadoAnulacion = { ok: true } | { ok: false; error: string };

export async function anularDocumento(
  actor: { id: string; name?: string | null },
  billingItemId: string,
  datos: { reason: string; reissue: boolean },
): Promise<ResultadoAnulacion> {
  const reason = datos.reason.trim();
  if (!reason) return { ok: false, error: "Escribe el motivo de la anulación." };
  if (reason.length > 1000) return { ok: false, error: "El motivo es muy largo (máximo 1000 caracteres)." };

  const cobro = await prisma.billingItem.findUnique({
    where: { id: billingItemId },
    select: {
      status: true, concept: true, amount: true, docType: true,
      invoiceNumber: true, invoicedAt: true, invoiceDueDate: true,
      company: { select: { name: true } },
      _count: { select: { payments: true } },
    },
  });
  if (!cobro) return { ok: false, error: "Cobro no encontrado" };

  const bloqueo = bloqueoDeAnulacion(cobro.status, cobro._count.payments);
  if (bloqueo) return { ok: false, error: bloqueo };

  const destino: BillingStatus = datos.reissue ? "POR_FACTURAR" : "ANULADO";

  const anulado = await prisma.$transaction(async (tx) => {
    // Las condiciones van dentro del `update`: dos clics a la vez, o un pago
    // en línea que entra en ese instante, no pueden colarse entre la lectura y
    // la escritura.
    const { count } = await tx.billingItem.updateMany({
      where: {
        id: billingItemId,
        status: cobro.status,
        invoiceNumber: cobro.invoiceNumber,
        payments: { none: {} },
      },
      data: {
        status: destino,
        invoiceNumber: null,
        invoiceDueDate: null,
        invoicedAt: null,
        paidAt: null,
        paidAmount: 0,
      },
    });
    if (count === 0) return false;

    await tx.billingVoid.create({
      data: {
        billingItemId,
        docType: cobro.docType,
        invoiceNumber: cobro.invoiceNumber,
        concept: cobro.concept,
        companyName: cobro.company.name,
        amount: cobro.amount,
        invoicedAt: cobro.invoicedAt,
        invoiceDueDate: cobro.invoiceDueDate,
        reason,
        reissue: datos.reissue,
        voidedById: actor.id,
        voidedByName: actor.name ?? "Alguien del equipo",
      },
    });

    // Un correo programado habla de la factura que acaba de morir.
    await tx.billingEmail.updateMany({
      where: { billingItemId, status: "PROGRAMADO" },
      data: { status: "CANCELADO" },
    });
    return true;
  });
  if (!anulado) return { ok: false, error: "El cobro cambió mientras lo anulabas. Recarga y vuelve a intentarlo." };

  const documento = [DOC_TYPE_LABELS[cobro.docType], cobro.invoiceNumber].filter(Boolean).join(" ");
  recordActivity({
    entityType: "BILLING",
    entityId: billingItemId,
    action: "billing.voided",
    label: await entityLabel("BILLING", billingItemId),
    changes: { status: { from: cobro.status, to: destino } },
    meta: { note: `${documento} · ${reason}` },
    actor,
  });
  await avisarFacturacion(actor, billingItemId, { tipo: "estado", from: cobro.status, to: destino });

  return { ok: true };
}
