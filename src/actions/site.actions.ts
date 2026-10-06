"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity/record";
import { actualizarSitio, crearSitio } from "@/lib/infra/records";

const siteSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200),
  domain: z.string().min(1, "El dominio es requerido").max(500),
  companyId: z.string().min(1, "La empresa es requerida"),
  documentation: z.string().optional(),
  architecture: z.string().optional(),
  isActive: z.boolean().default(true),
});

function leerSitio(formData: FormData) {
  return siteSchema.safeParse({
    name: formData.get("name"),
    domain: formData.get("domain"),
    companyId: formData.get("companyId"),
    documentation: formData.get("documentation") || undefined,
    architecture: formData.get("architecture") || undefined,
    isActive: formData.get("isActive") !== "false",
  });
}

export async function createSite(formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "crear");

  const parsed = leerSitio(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // El guardado vive en lib/infra/records: el asistente (MCP) guarda igual
  const r = await crearSitio(session.user, parsed.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/sitios");
  redirect("/admin/sitios");
}

export async function updateSite(siteId: string, formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

  const parsed = leerSitio(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await actualizarSitio(session.user, siteId, parsed.data);
  if (!r.ok) return { error: r.error };

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
