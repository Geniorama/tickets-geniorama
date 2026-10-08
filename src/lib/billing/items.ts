/**
 * Crear y editar cobros, sin sesión de por medio.
 *
 * Vivía dentro de las Server Actions, que empiezan con `requireCan()` y acaban
 * en `redirect()`. Se sacó aquí para que la web y el asistente (MCP) guarden un
 * cobro exactamente igual: mismos totales calculados en el servidor, mismas
 * reglas del archivo, mismos sellos de fecha y mismo historial. Quien llama
 * comprueba el permiso antes; aquí solo se valida el dato.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUS_LABELS, isInvoiced } from "@/lib/billing/status";
import { bloqueoDeArchivo, sellosPara } from "@/lib/billing/move";
import { calcularTotales } from "@/lib/billing/totals";
import { registrarPago } from "@/lib/billing/payments";
import { formatAmount } from "@/lib/money";
import { recordActivity, recordUpdate } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";
import { avisarFacturacion } from "@/lib/billing/notify";

export type Actor = { id: string; name?: string | null };

export type LineaInput = {
  concept: string;
  amount: number;
  taxRate: number;
  categoryId: string | null;
};

export type CobroInput = {
  concept: string;
  companyId: string;
  status: BillingStatus;
  lines: LineaInput[];
  dueDate: Date | null;
  invoiceDueDate: Date | null;
  invoiceNumber?: string;
  ownerId?: string;
  notes?: string;
};

export type ResultadoCobro = { ok: true; id: string } | { ok: false; error: string };

/**
 * Descarta categorías que no existen.
 *
 * El id viaja desde fuera y la clave foránea lo rechazaría con un error feo. Se
 * prefiere guardar el cobro sin catalogar —que se puede arreglar— a perder lo
 * que alguien acababa de escribir.
 */
async function conCategoriasValidas<T extends { categoryId: string | null }>(lineas: T[]): Promise<T[]> {
  const pedidas = [...new Set(lineas.map((l) => l.categoryId).filter((c): c is string => Boolean(c)))];
  if (pedidas.length === 0) return lineas;

  const existentes = new Set(
    (await prisma.billingCategory.findMany({
      where: { id: { in: pedidas } },
      select: { id: true },
    })).map((c) => c.id),
  );

  return lineas.map((l) => (l.categoryId && !existentes.has(l.categoryId) ? { ...l, categoryId: null } : l));
}

function lineasACrear(lineas: LineaInput[]) {
  return lineas.map((l, i) => ({
    concept: l.concept.trim(),
    amount: l.amount,
    taxRate: l.taxRate,
    categoryId: l.categoryId,
    position: i,
  }));
}

export async function crearCobro(actor: Actor, d: CobroInput): Promise<ResultadoCobro> {
  const empresa = await prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
  if (!empresa) return { ok: false, error: "Empresa no encontrada" };

  // Un cobro no nace archivado: al archivo se llega después de cobrarlo.
  const bloqueo = bloqueoDeArchivo(d.status, "BACKLOG");
  if (bloqueo) return { ok: false, error: bloqueo };

  // Los totales se calculan **siempre en el servidor**: lo que mande quien
  // llama es para pintar, no para guardar.
  const lineas = await conCategoriasValidas(d.lines);
  const totales = calcularTotales(lineas);
  const ajuste = sellosPara(d.status, { amount: totales.total, paidAmount: 0, invoicedAt: null, paidAt: null });

  const cobro = await prisma.billingItem.create({
    data: {
      concept: d.concept.trim(),
      companyId: d.companyId,
      status: d.status,
      amount: totales.total,
      subtotal: totales.subtotal,
      taxAmount: totales.taxAmount,
      lines: { create: lineasACrear(lineas) },
      dueDate: d.dueDate,
      // El vencimiento solo tiene sentido con factura emitida; si el cobro
      // retrocede se borra, igual que el número, para que no queden fechas
      // sueltas disparando recordatorios de algo que ya no está facturado.
      invoiceDueDate: isInvoiced(d.status) ? d.invoiceDueDate : null,
      invoiceNumber: isInvoiced(d.status) ? (d.invoiceNumber?.trim() || null) : null,
      ownerId: d.ownerId || null,
      notes: d.notes?.trim() || null,
      createdById: actor.id,
      ...ajuste,
    },
    select: { id: true },
  });

  recordActivity({
    entityType: "BILLING",
    entityId: cobro.id,
    action: "billing.created",
    label: await entityLabel("BILLING", cobro.id),
    meta: { note: `${formatAmount(totales.total) ?? totales.total} · ${BILLING_STATUS_LABELS[d.status]}` },
    actor,
  });

  await avisarFacturacion(actor, cobro.id, { tipo: "creado" });

  return { ok: true, id: cobro.id };
}

export async function actualizarCobro(actor: Actor, id: string, d: CobroInput): Promise<ResultadoCobro> {
  const actual = await prisma.billingItem.findUnique({
    where: { id },
    select: {
      amount: true, paidAmount: true, invoicedAt: true, paidAt: true,
      // Lo que el historial vigila, para poder decir qué se editó.
      concept: true, status: true, dueDate: true, ownerId: true,
    },
  });
  if (!actual) return { ok: false, error: "Cobro no encontrado" };

  // El archivo tiene la misma puerta desde aquí que desde el tablero.
  const bloqueo = bloqueoDeArchivo(d.status, actual.status);
  if (bloqueo) return { ok: false, error: bloqueo };

  const lineas = await conCategoriasValidas(d.lines);
  const totales = calcularTotales(lineas);
  const ajuste = sellosPara(d.status, { ...actual, amount: totales.total });

  await prisma.billingItem.update({
    where: { id },
    data: {
      concept: d.concept.trim(),
      status: d.status,
      amount: totales.total,
      subtotal: totales.subtotal,
      taxAmount: totales.taxAmount,
      // Se reemplazan enteras: intentar casar cuál cambió obliga a mandar ids
      // desde fuera y a confiar en ellos.
      lines: { deleteMany: {}, create: lineasACrear(lineas) },
      dueDate: d.dueDate,
      invoiceDueDate: isInvoiced(d.status) ? d.invoiceDueDate : null,
      invoiceNumber: isInvoiced(d.status) ? (d.invoiceNumber?.trim() || null) : null,
      ownerId: d.ownerId || null,
      notes: d.notes?.trim() || null,
      ...ajuste,
    },
  });

  // Cambiar de estado desde el formulario cuenta igual que arrastrar la
  // tarjeta: es el mismo hecho y se registra con la misma acción, para que
  // filtrar por «cambió el estado» los encuentre todos.
  const etiqueta = await entityLabel("BILLING", id);
  if (actual.status !== d.status) {
    recordActivity({
      entityType: "BILLING",
      entityId: id,
      action: "billing.status_changed",
      label: etiqueta,
      changes: { status: { from: actual.status, to: d.status } },
      actor,
    });
    await avisarFacturacion(actor, id, { tipo: "estado", from: actual.status, to: d.status });
  }
  recordUpdate({
    entityType: "BILLING",
    entityId: id,
    action: "billing.updated",
    label: etiqueta,
    before: actual,
    after: {
      concept: d.concept.trim(),
      amount: totales.total,
      dueDate: d.dueDate,
      ownerId: d.ownerId || null,
    },
    actor,
  });

  return { ok: true, id };
}

// ─── Abonos ──────────────────────────────────────────────────────────────────

/**
 * Los abonos se registran en el historial **del cobro**, no en el suyo: un
 * abono no tiene ficha que abrir, se lee dentro de su cobro.
 */
export async function apuntarEnCobro(
  billingItemId: string,
  action: string,
  actor: Actor,
  extra: { note?: string; changes?: Record<string, { from: unknown; to: unknown }> | null } = {},
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
export function resumenAbono(pago: { amount: number; paidOn: Date; method?: string | null }): string {
  const partes = [formatAmount(pago.amount) ?? String(pago.amount), pago.paidOn.toLocaleDateString("es-CO")];
  if (pago.method) partes.push(pago.method);
  return partes.join(" · ");
}

/** Apunta un abono y lo deja en el historial del cobro. */
export async function abonar(
  actor: Actor,
  billingItemId: string,
  datos: { amount: number; paidOn: Date; method?: string; note?: string },
): Promise<ResultadoCobro> {
  const r = await registrarPago(billingItemId, datos, actor.id);
  if (!r.ok) return r;
  await apuntarEnCobro(billingItemId, "billing.payment_added", actor, { note: resumenAbono(datos) });
  await avisarFacturacion(actor, billingItemId, { tipo: "abono", amount: datos.amount });
  return { ok: true, id: r.id };
}
