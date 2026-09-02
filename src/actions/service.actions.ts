"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity, recordUpdate } from "@/lib/activity/record";
import { getRequiredSession } from "@/lib/auth-helpers";

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
  await requireCan("INFRAESTRUCTURA", "crear");

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

  const servicio = await prisma.service.create({
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
    select: { id: true },
  });

  recordActivity({
    entityType: "SERVICE",
    entityId: servicio.id,
    action: "service.created",
    label: parsed.data.name,
    actor: session.user,
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function updateService(serviceId: string, formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

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

  const antes = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { name: true, dueDate: true, isActive: true },
  });

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

  recordUpdate({
    entityType: "SERVICE",
    entityId: serviceId,
    action: "service.updated",
    label: parsed.data.name,
    before: antes,
    after: {
      name: parsed.data.name,
      // La fecha de renovación es lo que más se mira de un servicio: moverla
      // cambia cuándo salta el aviso de vencimiento.
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      isActive: parsed.data.isActive,
    },
    extraFields: ["name", "dueDate", "isActive"],
    actor: session.user,
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function deleteService(serviceId: string) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

  const servicio = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { name: true },
  });

  await prisma.service.delete({ where: { id: serviceId } });

  recordActivity({
    entityType: "SERVICE",
    entityId: serviceId,
    action: "service.deleted",
    label: servicio?.name ?? null,
    actor: session.user,
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function duplicateService(serviceId: string) {
  const session = await getRequiredSession();
  await requireCan("INFRAESTRUCTURA", "editar");

  const original = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!original) return { error: "Servicio no encontrado" };

  const copy = await prisma.service.create({
    data: {
      name:        `Copia de ${original.name}`,
      type:        original.type,
      provider:    original.provider,
      description: original.description,
      dueDate:     original.dueDate,
      price:       original.price,
      notes:       original.notes,
      isActive:    original.isActive,
      companyId:   original.companyId,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect(`/admin/servicios/${copy.id}/edit`);
}
