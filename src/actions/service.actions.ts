"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, getRequiredSession } from "@/lib/auth-helpers";

const serviceSchema = z.object({
  name:        z.string().min(1, "El nombre es requerido"),
  type:        z.enum(["DOMINIO", "HOSTING", "CORREO", "SSL", "MANTENIMIENTO", "OTRO"]),
  provider:    z.enum(["GENIORAMA", "EXTERNO"]).default("GENIORAMA"),
  description: z.string().optional(),
  dueDate:     z.string().optional(),
  price:       z.string().optional(),
  notes:       z.string().optional(),
  isActive:    z.boolean().default(true),
  companyId:   z.string().min(1, "La empresa es requerida"),
});

export async function createService(formData: FormData) {
  const session = await getRequiredSession();
  await requireRole(["ADMINISTRADOR"]);

  const parsed = serviceSchema.safeParse({
    name:        formData.get("name"),
    type:        formData.get("type"),
    provider:    formData.get("provider") || "GENIORAMA",
    description: formData.get("description") || undefined,
    dueDate:     formData.get("dueDate") || undefined,
    price:       formData.get("price") || undefined,
    notes:       formData.get("notes") || undefined,
    isActive:    formData.get("isActive") === "true",
    companyId:   formData.get("companyId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.service.create({
    data: {
      name:        parsed.data.name,
      type:        parsed.data.type,
      provider:    parsed.data.provider,
      description: parsed.data.description ?? null,
      dueDate:     parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      price:       parsed.data.price ? parseFloat(parsed.data.price) : null,
      notes:       parsed.data.notes ?? null,
      isActive:    parsed.data.isActive,
      companyId:   parsed.data.companyId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function updateService(serviceId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const parsed = serviceSchema.safeParse({
    name:        formData.get("name"),
    type:        formData.get("type"),
    provider:    formData.get("provider") || "GENIORAMA",
    description: formData.get("description") || undefined,
    dueDate:     formData.get("dueDate") || undefined,
    price:       formData.get("price") || undefined,
    notes:       formData.get("notes") || undefined,
    isActive:    formData.get("isActive") === "true",
    companyId:   formData.get("companyId"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      name:        parsed.data.name,
      type:        parsed.data.type,
      provider:    parsed.data.provider,
      description: parsed.data.description ?? null,
      dueDate:     parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      price:       parsed.data.price ? parseFloat(parsed.data.price) : null,
      notes:       parsed.data.notes ?? null,
      isActive:    parsed.data.isActive,
      companyId:   parsed.data.companyId,
    },
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function deleteService(serviceId: string) {
  await requireRole(["ADMINISTRADOR"]);
  await prisma.service.delete({ where: { id: serviceId } });
  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}
