"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { deleteCommentsFor } from "@/lib/comments";
import { deleteAttachmentsFor } from "@/lib/attachments";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUSES, isInvoiced } from "@/lib/billing/status";
import { moveBillingStatus, sellosPara } from "@/lib/billing/move";
import { parseAmount } from "@/lib/money";
import { calcularTotales } from "@/lib/billing/totals";

const estados = BILLING_STATUSES as [BillingStatus, ...BillingStatus[]];

const lineaSchema = z.object({
  concept: z.string().min(1, "Cada línea necesita un concepto").max(200),
  amount:  z.number().positive("El importe de cada línea debe ser mayor que cero"),
  // Cero es exento. Se acota para que nadie mande un 900 % desde el cliente.
  taxRate: z.number().min(0).max(100),
  // Opcional: hay cobros anteriores a las categorías, y no se obliga a
  // inventar una para poder guardar.
  categoryId: z.string().nullable(),
});

const cobroSchema = z.object({
  concept:   z.string().min(1, "Escribe qué se cobra").max(200),
  companyId: z.string().min(1, "La empresa es requerida"),
  status:    z.enum(estados).default("BACKLOG"),
  lines:     z.array(lineaSchema).min(1, "Añade al menos una línea"),
  dueDate:   z.date().nullable(),
  invoiceDueDate: z.date().nullable(),
  invoiceNumber: z.string().max(60).optional(),
  ownerId:   z.string().optional(),
  notes:     z.string().max(4000).optional(),
});

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Las líneas viajan como JSON en un campo oculto: son una lista de longitud
 * variable, y nombrarlas `linea[0][importe]` obliga a reconstruir el array a
 * mano en el servidor.
 */
function leerLineas(raw: FormDataEntryValue | null): unknown {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l: { concept?: unknown; amount?: unknown; taxRate?: unknown; categoryId?: unknown }) => ({
      concept: String(l?.concept ?? "").trim(),
      amount: parseAmount(l?.amount) ?? 0,
      taxRate: Number(l?.taxRate ?? 0),
      categoryId: l?.categoryId ? String(l.categoryId) : null,
    }));
  } catch {
    return [];
  }
}

/**
 * Descarta categorías que no existen.
 *
 * El id viaja desde el navegador y la clave foránea lo rechazaría con un error
 * feo. Se prefiere guardar el cobro sin catalogar —que se puede arreglar— a
 * perder lo que alguien acababa de escribir.
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

function leer(formData: FormData) {
  return cobroSchema.safeParse({
    concept:   formData.get("concept"),
    companyId: formData.get("companyId"),
    status:    formData.get("status") || "BACKLOG",
    lines:     leerLineas(formData.get("lines")),
    dueDate:   parseDate(formData.get("dueDate")),
    invoiceDueDate: parseDate(formData.get("invoiceDueDate")),
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    ownerId:   formData.get("ownerId") || undefined,
    notes:     formData.get("notes") || undefined,
  });
}

export async function createBillingItem(formData: FormData) {
  const session = await requireCan("FACTURACION", "crear");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const empresa = await prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
  if (!empresa) return { error: "Empresa no encontrada" };

  // Los totales se calculan **siempre en el servidor**: lo que mande el
  // navegador es para pintar, no para guardar.
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
      lines: {
        create: lineas.map((l, i) => ({
          concept: l.concept.trim(),
          amount: l.amount,
          taxRate: l.taxRate,
          categoryId: l.categoryId,
          position: i,
        })),
      },
      dueDate: d.dueDate,
      // El vencimiento solo tiene sentido con factura emitida; si el cobro
      // retrocede se borra, igual que el número, para que no queden fechas
      // sueltas disparando recordatorios de algo que ya no está facturado.
      invoiceDueDate: isInvoiced(d.status) ? d.invoiceDueDate : null,
      invoiceNumber: isInvoiced(d.status) ? (d.invoiceNumber?.trim() || null) : null,
      ownerId: d.ownerId || null,
      notes: d.notes?.trim() || null,
      createdById: session.user.id,
      ...ajuste,
    },
    select: { id: true },
  });

  revalidatePath("/facturacion");
  redirect(`/facturacion/${cobro.id}`);
}

export async function updateBillingItem(id: string, formData: FormData) {
  await requireCan("FACTURACION", "editar");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const actual = await prisma.billingItem.findUnique({
    where: { id },
    select: { amount: true, paidAmount: true, invoicedAt: true, paidAt: true },
  });
  if (!actual) return { error: "Cobro no encontrado" };

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
      // desde el cliente y a confiar en ellos.
      lines: {
        deleteMany: {},
        create: lineas.map((l, i) => ({
          concept: l.concept.trim(),
          amount: l.amount,
          taxRate: l.taxRate,
          categoryId: l.categoryId,
          position: i,
        })),
      },
      dueDate: d.dueDate,
      // El vencimiento solo tiene sentido con factura emitida; si el cobro
      // retrocede se borra, igual que el número, para que no queden fechas
      // sueltas disparando recordatorios de algo que ya no está facturado.
      invoiceDueDate: isInvoiced(d.status) ? d.invoiceDueDate : null,
      invoiceNumber: isInvoiced(d.status) ? (d.invoiceNumber?.trim() || null) : null,
      ownerId: d.ownerId || null,
      notes: d.notes?.trim() || null,
      ...ajuste,
    },
  });

  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${id}`);
  return { success: true };
}

/**
 * Mueve un cobro de estado. Es lo que se hace arrastrando en el tablero.
 *
 * `abono` solo lo manda quien suelta la tarjeta en «Abonado»: es la única
 * transición que necesita un dato más, porque hay que decir cuánto entró.
 */
export async function setBillingStatus(id: string, status: BillingStatus, abono?: number | null) {
  await requireCan("FACTURACION", "editar");

  const r = await moveBillingStatus(id, status, abono);
  if (!r.ok) return { error: r.error };

  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${id}`);
  return { success: true };
}

export async function deleteBillingItem(id: string) {
  // Borrar un cobro borra el rastro de un dinero: pide GESTOR.
  await requireCan("FACTURACION", "gestionar");

  const cobro = await prisma.billingItem.findUnique({ where: { id }, select: { id: true } });
  if (!cobro) return { error: "Cobro no encontrado" };

  // Novedades y soportes polimórficos: sin cascada en la base, se borran aquí.
  // Mismo criterio que tareas y tickets.
  await prisma.$transaction(async (tx) => {
    await deleteCommentsFor("BILLING", id, tx);
    await deleteAttachmentsFor("BILLING", id, tx);
    await tx.billingItem.delete({ where: { id } });
  });

  revalidatePath("/facturacion");
  redirect("/facturacion");
}
