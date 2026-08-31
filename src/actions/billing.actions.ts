"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUSES, isInvoiced } from "@/lib/billing/status";
import { moveBillingStatus, sellosPara } from "@/lib/billing/move";
import { parseAmount } from "@/lib/money";

const estados = BILLING_STATUSES as [BillingStatus, ...BillingStatus[]];

const cobroSchema = z.object({
  concept:   z.string().min(1, "Escribe qué se cobra").max(200),
  companyId: z.string().min(1, "La empresa es requerida"),
  status:    z.enum(estados).default("BACKLOG"),
  amount:    z.number().positive("El importe debe ser mayor que cero"),
  dueDate:   z.date().nullable(),
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

function leer(formData: FormData) {
  return cobroSchema.safeParse({
    concept:   formData.get("concept"),
    companyId: formData.get("companyId"),
    status:    formData.get("status") || "BACKLOG",
    amount:    parseAmount(formData.get("amount")) ?? 0,
    dueDate:   parseDate(formData.get("dueDate")),
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

  const ajuste = sellosPara(d.status, { amount: d.amount, paidAmount: 0, invoicedAt: null, paidAt: null });

  const cobro = await prisma.billingItem.create({
    data: {
      concept: d.concept.trim(),
      companyId: d.companyId,
      status: d.status,
      amount: d.amount,
      dueDate: d.dueDate,
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

  const ajuste = sellosPara(d.status, { ...actual, amount: d.amount });

  await prisma.billingItem.update({
    where: { id },
    data: {
      concept: d.concept.trim(),
      status: d.status,
      amount: d.amount,
      dueDate: d.dueDate,
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

  await prisma.billingItem.delete({ where: { id } });

  revalidatePath("/facturacion");
  redirect("/facturacion");
}
