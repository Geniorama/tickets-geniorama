"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import type { AccountStage } from "@/generated/prisma";

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
  await requireCan("CRM", "crear");

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

  revalidatePath("/crm");
  redirect(`/crm/${account.id}`);
}

export async function updateAccount(accountId: string, formData: FormData) {
  await requireCan("CRM", "editar");

  const parsed = accountSchema.safeParse({
    name:    formData.get("name"),
    stage:   formData.get("stage") || "LEAD",
    taxId:   formData.get("taxId") || undefined,
    source:  formData.get("source") || undefined,
    ownerId: formData.get("ownerId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  revalidatePath("/crm");
  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

/**
 * Mueve la cuenta de etapa. Es la acción más frecuente del CRM, así que va
 * aparte del formulario completo.
 */
export async function setAccountStage(accountId: string, stage: AccountStage) {
  await requireCan("CRM", "editar");

  if (!STAGES.includes(stage)) return { error: "Etapa no válida" };

  await prisma.company.update({ where: { id: accountId }, data: { stage } });

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

  await prisma.$transaction(async (tx) => {
    // Solo puede haber un contacto principal por cuenta.
    if (parsed.data.isPrimary) {
      await tx.contact.updateMany({ where: { companyId: accountId }, data: { isPrimary: false } });
    }
    await tx.contact.create({
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
    });
  });

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

export async function updateContact(contactId: string, accountId: string, formData: FormData) {
  await requireCan("CRM", "editar");

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

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}

export async function deleteContact(contactId: string, accountId: string) {
  await requireCan("CRM", "editar");

  await prisma.contact.deleteMany({ where: { id: contactId, companyId: accountId } });

  revalidatePath(`/crm/${accountId}`);
  return { success: true };
}
