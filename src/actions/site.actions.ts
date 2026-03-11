"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";

const siteSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  domain: z.string().min(1, "El dominio es requerido").max(500),
  companyId: z.string().min(1, "La empresa es requerida"),
  documentation: z.string().optional(),
  architecture: z.string().optional(),
  isActive: z.boolean().default(true),
});

export async function createSite(formData: FormData) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    companyId: formData.get("companyId"),
    documentation: formData.get("documentation") || undefined,
    architecture: formData.get("architecture") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.site.create({
    data: {
      name: parsed.data.name,
      domain: parsed.data.domain,
      companyId: parsed.data.companyId,
      documentation: parsed.data.documentation ?? null,
      architecture: parsed.data.architecture ?? null,
      isActive: parsed.data.isActive,
    },
  });

  revalidatePath("/admin/sitios");
  redirect("/admin/sitios");
}

export async function updateSite(siteId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  const parsed = siteSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    companyId: formData.get("companyId"),
    documentation: formData.get("documentation") || undefined,
    architecture: formData.get("architecture") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

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

  revalidatePath("/admin/sitios");
  redirect("/admin/sitios");
}

export async function deleteSite(siteId: string) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  await prisma.site.delete({ where: { id: siteId } });
  revalidatePath("/admin/sitios");
  return { success: true };
}
