"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import type { AccountStage, DealStage } from "@/generated/prisma";
import { DEAL_STAGES, isClosedStage } from "@/lib/crm/deals";
import {
  emitAccountHook, emitActivityHook, emitContactHook, emitDealHook,
  emitDealStageHooks, emitDeletedHook,
} from "@/lib/hooks/dispatch";
import { contactPayload, dealPayload } from "@/lib/hooks/payload";

const STAGES = ["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"] as const;

const accountSchema = z.object({
  name:    z.string().min(1, "El nombre es requerido").max(160),
  stage:   z.enum(STAGES).default("LEAD"),
  taxId:   z.string().max(60).optional(),
  source:  z.string().max(80).optional(),
  ownerId: z.string().optional(),
});

/**
 * Crea una cuenta. Nace como LEAD salvo que se diga otra cosa: lo habitual es
 * registrar un prospecto, no un cliente ya cerrado.
 */
export async function createAccount(formData: FormData) {
  const session = await requireCan("CRM", "crear");

  const parsed = accountSchema.safeParse({
    name:    formData.get("name"),
    stage:   formData.get("stage") || "LEAD",
    taxId:   formData.get("taxId") || undefined,
    source:  formData.get("source") || undefined,
    ownerId: formData.get("ownerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await prisma.company.create({
    data: {
      name:    parsed.data.name.trim(),
      stage:   parsed.data.stage,
      taxId:   parsed.data.taxId?.trim() || null,
      source:  parsed.data.source?.trim() || null,
      ownerId: parsed.data.ownerId || null,
    },
    select: { id: true },
  });

  emitAccountHook("account.created", account.id, { actor: session.user });

  revalidatePath("/crm");
  redirect(`/crm/${account.id}`);
}

export async function updateAccount(accountId: string, formData: FormData) {
  const session = await requireCan("CRM", "editar");

  const parsed = accountSchema.safeParse({
    name:    formData.get("name"),
    stage:   formData.get("stage") || "LEAD",
    taxId:   formData.get("taxId") || undefined,
    source:  formData.get("source") || undefined,
    ownerId: formData.get("ownerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const antes = await prisma.company.findUnique({
    where: { id: accountId },
    select: { stage: true },
  });
  if (!antes) return { error: "Cuenta no encontrada" };

  await prisma.company.update({
    where: { id: accountId },
    data: {
      name:    parsed.data.name.trim(),
      stage:   parsed.data.stage,
      taxId:   parsed.data.taxId?.trim() || null,
      source:  parsed.data.source?.trim() || null,
      ownerId: parsed.data.ownerId || null,
    },
  });

  emitAccountHook("account.updated", accountId, { actor: session.user });
  // Que un lead pase a cliente es lo que quiere enganchar quien integra, y
  // desde este formulario también puede ocurrir.
  if (antes.stage !== parsed.data.stage) {
    emitAccountHook("account.stage_changed", accountId, {
      actor: session.user,
      changes: { stage: { from: antes.stage, to: parsed.data.stage } },
    });
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

/**
 * Mueve la cuenta de etapa. Es la acción más frecuente del CRM, así que va
 * aparte del formulario completo.
 */
export async function setAccountStage(accountId: string, stage: AccountStage) {
  const session = await requireCan("CRM", "editar");

  if (!STAGES.includes(stage)) return { error: "Etapa no válida" };

  const antes = await prisma.company.findUnique({ where: { id: accountId }, select: { stage: true } });
  if (!antes) return { error: "Cuenta no encontrada" };

  await prisma.company.update({ where: { id: accountId }, data: { stage } });

  if (antes.stage !== stage) {
    emitAccountHook("account.stage_changed", accountId, {
      actor: session.user,
      changes: { stage: { from: antes.stage, to: stage } },
    });
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

// ─── Contactos ────────────────────────────────────────────────────────────────

const contactSchema = z.object({
  name:     z.string().min(1, "El nombre es requerido").max(160),
  email:    z.string().email("El correo no es válido").max(160).optional().or(z.literal("")),
  phone:    z.string().max(60).optional(),
  position: z.string().max(80).optional(),
  notes:    z.string().max(2000).optional(),
  isPrimary: z.boolean().default(false),
});

export async function createContact(accountId: string, formData: FormData) {
  const session = await requireCan("CRM", "crear");

  const parsed = contactSchema.safeParse({
    name:      formData.get("name"),
    email:     formData.get("email") || "",
    phone:     formData.get("phone") || undefined,
    position:  formData.get("position") || undefined,
    notes:     formData.get("notes") || undefined,
    isPrimary: formData.get("isPrimary") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const account = await prisma.company.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) return { error: "Cuenta no encontrada" };

  const contacto = await prisma.$transaction(async (tx) => {
    // Solo puede haber un contacto principal por cuenta.
    if (parsed.data.isPrimary) {
      await tx.contact.updateMany({ where: { companyId: accountId }, data: { isPrimary: false } });
    }
    return tx.contact.create({
      data: {
        companyId:  accountId,
        name:       parsed.data.name.trim(),
        email:      parsed.data.email?.trim() || null,
        phone:      parsed.data.phone?.trim() || null,
        position:   parsed.data.position?.trim() || null,
        notes:      parsed.data.notes?.trim() || null,
        isPrimary:  parsed.data.isPrimary,
        createdById: session.user.id,
      },
      select: { id: true },
    });
  });

  emitContactHook("contact.created", contacto.id, { actor: session.user });

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

export async function updateContact(contactId: string, accountId: string, formData: FormData) {
  const session = await requireCan("CRM", "editar");

  const parsed = contactSchema.safeParse({
    name:      formData.get("name"),
    email:     formData.get("email") || "",
    phone:     formData.get("phone") || undefined,
    position:  formData.get("position") || undefined,
    notes:     formData.get("notes") || undefined,
    isPrimary: formData.get("isPrimary") === "true",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.contact.updateMany({ where: { companyId: accountId }, data: { isPrimary: false } });
    }
    // Acotado a la cuenta: un id suelto no puede editar el contacto de otra.
    await tx.contact.updateMany({
      where: { id: contactId, companyId: accountId },
      data: {
        name:      parsed.data.name.trim(),
        email:     parsed.data.email?.trim() || null,
        phone:     parsed.data.phone?.trim() || null,
        position:  parsed.data.position?.trim() || null,
        notes:     parsed.data.notes?.trim() || null,
        isPrimary: parsed.data.isPrimary,
      },
    });
  });

  emitContactHook("contact.updated", contactId, { actor: session.user });

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

export async function deleteContact(contactId: string, accountId: string) {
  const session = await requireCan("CRM", "editar");

  // El payload se arma antes de borrar: después ya no hay a quién consultar.
  const payload = await contactPayload(contactId).catch(() => null);

  const { count } = await prisma.contact.deleteMany({ where: { id: contactId, companyId: accountId } });

  // Solo se avisa si de verdad se borró algo suyo: un id de otra cuenta no
  // borra nada y tampoco debe generar un evento.
  if (count > 0 && payload) {
    emitDeletedHook("contact.deleted", payload, { actor: session.user });
  }

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

// ─── Oportunidades ────────────────────────────────────────────────────────────

const dealStages = DEAL_STAGES as [DealStage, ...DealStage[]];

const dealSchema = z.object({
  title:     z.string().min(1, "El título es requerido").max(160),
  companyId: z.string().min(1, "La cuenta es requerida"),
  stage:     z.enum(dealStages).default("NUEVA"),
  amount:    z.number().nonnegative("El valor no puede ser negativo").nullable(),
  expectedCloseAt: z.date().nullable(),
  contactId: z.string().optional(),
  ownerId:   z.string().optional(),
  notes:     z.string().max(4000).optional(),
});

/** El importe llega como texto del formulario y puede venir vacío o con puntos de miles. */
function parseAmount(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function readDeal(formData: FormData) {
  return dealSchema.safeParse({
    title:     formData.get("title"),
    companyId: formData.get("companyId"),
    stage:     formData.get("stage") || "NUEVA",
    amount:    parseAmount(formData.get("amount")),
    expectedCloseAt: parseDate(formData.get("expectedCloseAt")),
    contactId: formData.get("contactId") || undefined,
    ownerId:   formData.get("ownerId") || undefined,
    notes:     formData.get("notes") || undefined,
  });
}

/**
 * El contacto elegido tiene que ser de la cuenta: si no se comprueba, un id
 * suelto en el formulario ataría a la oportunidad una persona de otra empresa.
 */
async function contactBelongsTo(contactId: string | undefined, companyId: string) {
  if (!contactId) return true;
  const count = await prisma.contact.count({ where: { id: contactId, companyId } });
  return count > 0;
}

export async function createDeal(formData: FormData) {
  const session = await requireCan("CRM", "crear");

  const parsed = readDeal(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const account = await prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
  if (!account) return { error: "Cuenta no encontrada" };
  if (!(await contactBelongsTo(d.contactId, d.companyId))) {
    return { error: "El contacto no pertenece a esta cuenta" };
  }

  const deal = await prisma.deal.create({
    data: {
      title:     d.title.trim(),
      companyId: d.companyId,
      stage:     d.stage,
      amount:    d.amount,
      expectedCloseAt: d.expectedCloseAt,
      closedAt:  isClosedStage(d.stage) ? new Date() : null,
      contactId: d.contactId || null,
      ownerId:   d.ownerId || null,
      notes:     d.notes?.trim() || null,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  emitDealHook("deal.created", deal.id, { actor: session.user });
  // Nacer ya cerrada es raro pero posible (se registra una venta ya hecha), y
  // quien escucha `deal.won` espera enterarse igual.
  if (isClosedStage(d.stage)) {
    emitDealStageHooks(deal.id, "NUEVA", d.stage, { actor: session.user });
  }

  revalidatePath("/crm/oportunidades");
  revalidatePath(`/crm/${d.companyId}`);
  redirect(`/crm/oportunidades/${deal.id}`);
}

export async function updateDeal(dealId: string, formData: FormData) {
  const session = await requireCan("CRM", "editar");

  const parsed = readDeal(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const current = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { stage: true, closedAt: true, companyId: true },
  });
  if (!current) return { error: "Oportunidad no encontrada" };

  // La cuenta de una oportunidad no se cambia desde aquí: mover el historial de
  // una empresa a otra es otra operación, no un campo del formulario.
  if (!(await contactBelongsTo(d.contactId, current.companyId))) {
    return { error: "El contacto no pertenece a esta cuenta" };
  }

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      title:  d.title.trim(),
      stage:  d.stage,
      amount: d.amount,
      expectedCloseAt: d.expectedCloseAt,
      closedAt: isClosedStage(d.stage) ? (current.closedAt ?? new Date()) : null,
      contactId: d.contactId || null,
      ownerId:   d.ownerId || null,
      notes:     d.notes?.trim() || null,
    },
  });

  emitDealHook("deal.updated", dealId, { actor: session.user });
  emitDealStageHooks(dealId, current.stage, d.stage, { actor: session.user });

  revalidatePath("/crm/oportunidades");
  revalidatePath(`/crm/oportunidades/${dealId}`);
  revalidatePath(`/crm/${current.companyId}`);
  return { success: true };
}

/**
 * Mover de etapa es lo que se hace en el tablero, arrastrando. Sella o borra
 * `closedAt` según el destino, para que reabrir una oportunidad la devuelva de
 * verdad al pipeline en vez de dejarla cerrada con otra etiqueta.
 */
export async function setDealStage(dealId: string, stage: DealStage, lostReason?: string) {
  const session = await requireCan("CRM", "editar");

  if (!DEAL_STAGES.includes(stage)) return { error: "Etapa no válida" };

  const current = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { companyId: true, closedAt: true, stage: true },
  });
  if (!current) return { error: "Oportunidad no encontrada" };

  const cerrando = isClosedStage(stage);

  await prisma.deal.update({
    where: { id: dealId },
    data: {
      stage,
      closedAt: cerrando ? (current.closedAt ?? new Date()) : null,
      lostReason: stage === "PERDIDA" ? (lostReason?.trim() || null) : null,
    },
  });

  emitDealStageHooks(dealId, current.stage, stage, { actor: session.user });

  revalidatePath("/crm/oportunidades");
  revalidatePath(`/crm/oportunidades/${dealId}`);
  revalidatePath(`/crm/${current.companyId}`);
  return { success: true };
}

export async function deleteDeal(dealId: string) {
  // Borrar se lleva el historial de la oportunidad por delante, así que pide
  // GESTOR y no basta con poder editar.
  const session = await requireCan("CRM", "gestionar");

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { companyId: true } });
  if (!deal) return { error: "Oportunidad no encontrada" };

  const payload = await dealPayload(dealId).catch(() => null);

  // Sus actividades caen con ella por `onDelete: Cascade`.
  await prisma.deal.delete({ where: { id: dealId } });

  if (payload) emitDeletedHook("deal.deleted", payload, { actor: session.user });

  revalidatePath("/crm/oportunidades");
  revalidatePath(`/crm/${deal.companyId}`);
  redirect("/crm/oportunidades");
}

// ─── Actividad ────────────────────────────────────────────────────────────────

const activitySchema = z.object({
  type:      z.enum(["NOTA", "LLAMADA", "CORREO", "REUNION", "WHATSAPP"]).default("NOTA"),
  summary:   z.string().min(1, "Escribe qué pasó").max(200),
  notes:     z.string().max(4000).optional(),
  occurredAt: z.date().nullable(),
  contactId: z.string().optional(),
  dealId:    z.string().optional(),
});

/**
 * Apunta una interacción. Se registra siempre contra la cuenta, y además
 * contra la oportunidad si la hubo: así la ficha de la cuenta muestra el
 * historial completo sin tener que unir dos listas.
 */
export async function logActivity(accountId: string, formData: FormData) {
  const session = await requireCan("CRM", "crear");

  const parsed = activitySchema.safeParse({
    type:      formData.get("type") || "NOTA",
    summary:   formData.get("summary"),
    notes:     formData.get("notes") || undefined,
    occurredAt: parseDate(formData.get("occurredAt")),
    contactId: formData.get("contactId") || undefined,
    dealId:    formData.get("dealId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = parsed.data;

  const account = await prisma.company.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) return { error: "Cuenta no encontrada" };
  if (!(await contactBelongsTo(a.contactId, accountId))) {
    return { error: "El contacto no pertenece a esta cuenta" };
  }
  if (a.dealId) {
    const count = await prisma.deal.count({ where: { id: a.dealId, companyId: accountId } });
    if (count === 0) return { error: "La oportunidad no pertenece a esta cuenta" };
  }

  const actividad = await prisma.crmActivity.create({
    select: { id: true },
    data: {
      companyId: accountId,
      dealId:    a.dealId || null,
      contactId: a.contactId || null,
      type:      a.type,
      summary:   a.summary.trim(),
      notes:     a.notes?.trim() || null,
      // Sin fecha explícita se asume que acaba de pasar, que es el caso normal
      // al apuntarlo justo después de colgar.
      occurredAt: a.occurredAt ?? new Date(),
      createdById: session.user.id,
    },
  });

  emitActivityHook(actividad.id, { actor: session.user });

  revalidatePath(`/crm/${accountId}`);
  if (a.dealId) revalidatePath(`/crm/oportunidades/${a.dealId}`);
  return { success: true };
}

export async function deleteActivity(activityId: string, accountId: string) {
  await requireCan("CRM", "editar");

  // Acotado a la cuenta, igual que los contactos.
  await prisma.crmActivity.deleteMany({ where: { id: activityId, companyId: accountId } });

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}
