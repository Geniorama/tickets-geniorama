"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity, recordUpdate } from "@/lib/activity/record";

const siteSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  domain: z.string().min(1, "El dominio es requerido").max(500),
  companyId: z.string().min(1, "La empresa es requerida"),
  documentation: z.string().optional(),
  architecture: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function createSite(formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "crear");

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    companyId: formData.get("companyId"),
    documentation: formData.get("documentation") || undefined,
    architecture: formData.get("architecture") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const site = await prisma.site.create({
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      companyId: parsed.data.companyId,
      documentation: parsed.data.documentation ?? null,
      architecture: parsed.data.architecture ?? null,
      isActive: parsed.data.isActive,
    },
    select: { id: true },
  });

  recordActivity({
    entityType: "SITE",
    entityId: site.id,
    action: "site.created",
    label: parsed.data.name,
    meta: { note: parsed.data.domain },
    actor: session.user,
  });

  revalidatePath("/admin/sitios");
  redirect("/admin/sitios");
}

export async function updateSite(siteId: string, formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    companyId: formData.get("companyId"),
    documentation: formData.get("documentation") || undefined,
    architecture: formData.get("architecture") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const antes = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true, domain: true, isActive: true },
  });

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      companyId: parsed.data.companyId,
      documentation: parsed.data.documentation ?? null,
      architecture: parsed.data.architecture ?? null,
      isActive: parsed.data.isActive,
    },
  });

  recordUpdate({
    entityType: "SITE",
    entityId: siteId,
    action: "site.updated",
    label: parsed.data.name,
    before: antes,
    after: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      isActive: parsed.data.isActive,
    },
    extraFields: ["name", "domain", "isActive"],
    actor: session.user,
  });

  revalidatePath("/admin/sitios");
  redirect("/admin/sitios");
}

export async function deleteSite(siteId: string) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

  // El nombre antes de que se vaya: después no hay sitio que consultar.
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });

  await prisma.site.delete({ where: { id: siteId } });

  recordActivity({
    entityType: "SITE",
    entityId: siteId,
    action: "site.deleted",
    label: site?.name ?? null,
    actor: session.user,
  });

  revalidatePath("/admin/sitios");
  return { success: true };
}
