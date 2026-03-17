"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { encrypt } from "@/lib/vault-crypto";

const vaultSchema = z.object({
  title:     z.string().min(1, "El título es requerido").max(200),
  username:  z.string().optional(),
  password:  z.string().min(1, "La contraseña es requerida"),
  url:       z.string().url("URL inválida").or(z.literal("")).optional(),
  notes:     z.string().optional(),
  companyId: z.string().optional(),
  siteId:    z.string().optional(),
  serviceId: z.string().optional(),
});

export async function createVaultEntry(formData: FormData) {
  const session = await getRequiredSession();

  const parsed = vaultSchema.safeParse({
    title:     formData.get("title"),
    username:  formData.get("username") || undefined,
    password:  formData.get("password"),
    url:       formData.get("url") || undefined,
    notes:     formData.get("notes") || undefined,
    companyId: formData.get("companyId") || undefined,
    siteId:    formData.get("siteId") || undefined,
    serviceId: formData.get("serviceId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const entry = await prisma.vaultEntry.create({
    data: {
      title:      parsed.data.title,
      username:   parsed.data.username ?? null,
      password:   encrypt(parsed.data.password),
      url:        parsed.data.url || null,
      notes:      parsed.data.notes ?? null,
      companyId:  parsed.data.companyId ?? null,
      siteId:     parsed.data.siteId ?? null,
      serviceId:  parsed.data.serviceId ?? null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/boveda");
  redirect(`/boveda/${entry.id}`);
}

export async function updateVaultEntry(entryId: string, formData: FormData) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Entrada no encontrada" };
  if (!admin && entry.createdById !== session.user.id) return { error: "Sin permiso" };

  const parsed = vaultSchema.safeParse({
    title:     formData.get("title"),
    username:  formData.get("username") || undefined,
    password:  formData.get("password"),
    url:       formData.get("url") || undefined,
    notes:     formData.get("notes") || undefined,
    companyId: formData.get("companyId") || undefined,
    siteId:    formData.get("siteId") || undefined,
    serviceId: formData.get("serviceId") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.vaultEntry.update({
    where: { id: entryId },
    data: {
      title:     parsed.data.title,
      username:  parsed.data.username ?? null,
      password:  encrypt(parsed.data.password),
      url:       parsed.data.url || null,
      notes:     parsed.data.notes ?? null,
      companyId: parsed.data.companyId ?? null,
      siteId:    parsed.data.siteId ?? null,
      serviceId: parsed.data.serviceId ?? null,
    },
  });

  revalidatePath("/boveda");
  revalidatePath(`/boveda/${entryId}`);
  redirect(`/boveda/${entryId}`);
}

export async function deleteVaultEntry(entryId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Entrada no encontrada" };
  if (!admin && entry.createdById !== session.user.id) return { error: "Sin permiso" };

  await prisma.vaultEntry.delete({ where: { id: entryId } });
  revalidatePath("/boveda");
  return { success: true };
}

export async function addVaultShare(entryId: string, userId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Entrada no encontrada" };
  if (!admin && entry.createdById !== session.user.id) return { error: "Sin permiso" };
  if (userId === entry.createdById) return { error: "No puedes compartir contigo mismo" };

  await prisma.vaultShare.upsert({
    where: { vaultEntryId_userId: { vaultEntryId: entryId, userId } },
    create: { vaultEntryId: entryId, userId },
    update: {},
  });

  revalidatePath(`/boveda/${entryId}`);
  return { success: true };
}

export async function linkVaultToProject(projectId: string, vaultEntryId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  // Verificar acceso a la entrada
  const entry = await prisma.vaultEntry.findFirst({
    where: admin
      ? { id: vaultEntryId }
      : { id: vaultEntryId, OR: [{ createdById: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] },
  });
  if (!entry) return { error: "Sin acceso a esta entrada de Bóveda" };

  await prisma.projectVaultEntry.upsert({
    where: { projectId_vaultEntryId: { projectId, vaultEntryId } },
    create: { projectId, vaultEntryId },
    update: {},
  });

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function unlinkVaultFromProject(projectId: string, vaultEntryId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  // Solo admin o quien tenga acceso a la entrada puede desvinculara
  const entry = await prisma.vaultEntry.findFirst({
    where: admin
      ? { id: vaultEntryId }
      : { id: vaultEntryId, OR: [{ createdById: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] },
  });
  if (!entry) return { error: "Sin acceso a esta entrada de Bóveda" };

  await prisma.projectVaultEntry.deleteMany({ where: { projectId, vaultEntryId } });

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function linkVaultToTicket(ticketId: string, vaultEntryId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findFirst({
    where: admin
      ? { id: vaultEntryId }
      : { id: vaultEntryId, OR: [{ createdById: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] },
  });
  if (!entry) return { error: "Sin acceso a esta entrada de Bóveda" };

  await prisma.ticketVaultEntry.upsert({
    where: { ticketId_vaultEntryId: { ticketId, vaultEntryId } },
    create: { ticketId, vaultEntryId },
    update: {},
  });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function unlinkVaultFromTicket(ticketId: string, vaultEntryId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findFirst({
    where: admin
      ? { id: vaultEntryId }
      : { id: vaultEntryId, OR: [{ createdById: session.user.id }, { sharedWith: { some: { userId: session.user.id } } }] },
  });
  if (!entry) return { error: "Sin acceso a esta entrada de Bóveda" };

  await prisma.ticketVaultEntry.deleteMany({ where: { ticketId, vaultEntryId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function removeVaultShare(entryId: string, userId: string) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);

  const entry = await prisma.vaultEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: "Entrada no encontrada" };
  if (!admin && entry.createdById !== session.user.id) return { error: "Sin permiso" };

  await prisma.vaultShare.deleteMany({
    where: { vaultEntryId: entryId, userId },
  });

  revalidatePath(`/boveda/${entryId}`);
  return { success: true };
}
