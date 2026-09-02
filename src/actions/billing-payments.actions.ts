"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCan } from "@/lib/access/can";
import { parseAmount } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/roles";
import { addFileAttachments, deleteAttachment } from "@/lib/attachments";
import { registrarPago, actualizarPago, borrarPago } from "@/lib/billing/payments";
import { formatAmount } from "@/lib/money";
import { diffFields, recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";

/**
 * Los abonos se registran en el historial **del cobro**, no en el suyo.
 *
 * Un abono no tiene ficha que abrir: se lee dentro de su cobro, y ahí es donde
 * hace falta ver que alguien corrigió un importe de 300.000 a 500.000. Colgarlo
 * de `BILLING_PAYMENT` lo escondería justo de quien lo busca.
 */
async function apuntar(
  billingItemId: string,
  action: string,
  actor: { id: string; name?: string | null },
  extra: { note?: string; changes?: Record<string, { from: unknown; to: unknown }> } = {},
) {
  recordActivity({
    entityType: "BILLING",
    entityId: billingItemId,
    action,
    label: await entityLabel("BILLING", billingItemId),
    changes: extra.changes ?? null,
    meta: extra.note ? { note: extra.note } : null,
    actor,
  });
}

/** El abono en una línea: «$300.000 · 12/03/2026 · Transferencia». */
function resumen(pago: { amount: number; paidOn: Date; method?: string | null }): string {
  const partes = [formatAmount(pago.amount) ?? String(pago.amount), pago.paidOn.toLocaleDateString("es-CO")];
  if (pago.method) partes.push(pago.method);
  return partes.join(" · ");
}

/**
 * Los abonos de un cobro.
 *
 * La lógica vive en `lib/billing/payments.ts` para poder probarla sin sesión.
 * Aquí solo el guardia, la validación de lo que llega del navegador y el
 * refresco de las pantallas que muestran dinero.
 */

// Mediodía y no medianoche al leer la fecha: con husos por medio, una fecha a
// las 00:00 se guarda como el día anterior y el abono aparece con fecha
// equivocada.
const pagoSchema = z.object({
  amount: z.number().positive("El abono tiene que ser mayor que cero"),
  paidOn: z.date({ message: "Falta la fecha del abono" }),
  method: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
});

function refrescar(billingItemId: string) {
  revalidatePath(`/facturacion/${billingItemId}`);
  // El tablero no se revalida aquí: se renderiza en cada visita, así que ya
  // trae los importes al día. Pedirlo además era la única diferencia con el
  // panel de novedades, que sí se refrescaba solo.
}

export async function addBillingPayment(billingItemId: string, formData: FormData) {
  const session = await requireCan("FACTURACION", "editar");

  const parsed = leerPago(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await registrarPago(billingItemId, parsed.data, session.user.id);
  if (!r.ok) return { error: r.error };

  await apuntar(billingItemId, "billing.payment_added", session.user, {
    note: resumen(parsed.data),
  });

  refrescar(billingItemId);
  return { success: true };
}

/** Lee el formulario de un abono, que es el mismo al crear y al corregir. */
function leerPago(formData: FormData) {
  const crudo = String(formData.get("paidOn") ?? "").trim();
  return pagoSchema.safeParse({
    amount: parseAmount(formData.get("amount")) ?? 0,
    paidOn: crudo ? new Date(`${crudo}T12:00:00`) : undefined,
    method: String(formData.get("method") ?? "").trim() || undefined,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
}

/**
 * Corregir un abono pide lo mismo que apuntarlo.
 *
 * Podría parecer que tocar una cifra ya guardada merece más permiso que
 * escribirla, pero quien puede editar ya cambia el total del cobro entero, que
 * es un número más gordo. Exigir más aquí solo conseguiría que un importe mal
 * tecleado se quedara mal.
 */
export async function updateBillingPayment(
  pagoId: string,
  billingItemId: string,
  formData: FormData,
) {
  const session = await requireCan("FACTURACION", "editar");

  const parsed = leerPago(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // La foto previa se toma antes de corregir: corregir un importe ya guardado
  // es exactamente lo que hay que poder auditar después.
  const antes = await prisma.billingPayment.findFirst({
    where: { id: pagoId, billingItemId },
    select: { amount: true, paidOn: true, method: true },
  });

  const r = await actualizarPago(pagoId, billingItemId, parsed.data);
  if (!r.ok) return { error: r.error };

  await apuntar(billingItemId, "billing.payment_updated", session.user, {
    changes: diffFields("BILLING_PAYMENT", antes, {
      amount: parsed.data.amount,
      paidAt: parsed.data.paidOn,
      method: parsed.data.method ?? null,
    }, ["amount", "paidAt", "method"]),
  });

  refrescar(billingItemId);
  return { success: true };
}

export async function deleteBillingPayment(pagoId: string, billingItemId: string) {
  // Quitar un abono cambia lo cobrado y puede devolver el cobro a «Facturado»:
  // pide GESTOR, como borrar el cobro entero.
  const session = await requireCan("FACTURACION", "gestionar");

  // Qué se va, antes de que se vaya: sin esto el historial diría que alguien
  // borró un abono, pero no cuál.
  const antes = await prisma.billingPayment.findFirst({
    where: { id: pagoId, billingItemId },
    select: { amount: true, paidOn: true, method: true },
  });

  const r = await borrarPago(pagoId, billingItemId);
  if (!r.ok) return { error: r.error };

  await apuntar(billingItemId, "billing.payment_deleted", session.user, {
    note: antes ? resumen(antes) : undefined,
  });

  refrescar(billingItemId);
  return { success: true };
}

// ─── Comprobantes ────────────────────────────────────────────────────────────

/**
 * El comprobante de un abono.
 *
 * Cuelga del abono y no del cobro: con tres pagos parciales hay tres soportes,
 * y todos juntos en el cobro serían un montón de PDF sin saber cuál es de cuál.
 *
 * Nada de tablas nuevas: los adjuntos viven desde la Fase 0 en una tabla
 * compartida. Aquí solo se comprueba que el abono sea de este cobro, para que
 * un id suelto no cuelgue archivos del abono de otra factura.
 */
async function esDeEsteCobro(pagoId: string, billingItemId: string): Promise<boolean> {
  const n = await prisma.billingPayment.count({ where: { id: pagoId, billingItemId } });
  return n > 0;
}

export async function addPaymentReceipt(
  pagoId: string,
  billingItemId: string,
  formData: FormData,
) {
  const session = await requireCan("FACTURACION", "editar");

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No se eligió ningún archivo" };

  if (!(await esDeEsteCobro(pagoId, billingItemId))) return { error: "Ese abono no existe en este cobro" };

  const { errors } = await addFileAttachments({
    entityType: "BILLING_PAYMENT",
    entityId: pagoId,
    storageKey: "abono",
    files,
    uploadedById: session.user.id,
  });

  await apuntar(billingItemId, "billing.receipt_added", session.user, {
    note: files.map((f) => f.name).join(", "),
  });

  refrescar(billingItemId);
  return errors.length > 0 ? { success: true, warning: errors.join(" · ") } : { success: true };
}

export async function deletePaymentReceipt(
  attachmentId: string,
  pagoId: string,
  billingItemId: string,
) {
  const session = await requireCan("FACTURACION", "editar");

  if (!(await esDeEsteCobro(pagoId, billingItemId))) return { error: "Ese abono no existe en este cobro" };

  const r = await deleteAttachment(
    attachmentId,
    { entityType: "BILLING_PAYMENT", entityId: pagoId },
    { id: session.user.id, isAdmin: isAdmin(session.user.role) },
  );

  if (!r.error) await apuntar(billingItemId, "billing.receipt_deleted", session.user);

  refrescar(billingItemId);
  return r.error ? { error: r.error } : { success: true };
}
