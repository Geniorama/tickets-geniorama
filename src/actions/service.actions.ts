"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity/record";
import { actualizarServicio, crearServicio } from "@/lib/infra/records";
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

/** Lee el formulario de un servicio, que es el mismo al crear y al editar. */
function leerServicio(formData: FormData) {
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
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  return {
    data: {
      ...d,
      dueDate: d.dueDate ? new Date(d.dueDate) : null,
      price: d.price ? parseFloat(d.price) : null,
    },
  } as const;
}

export async function createService(formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "crear");

  const leido = leerServicio(formData);
  if ("error" in leido) return { error: leido.error };

  // El guardado vive en lib/infra/records: el asistente (MCP) guarda igual
  const r = await crearServicio(session.user, leido.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/servicios");
  revalidatePath("/mis-servicios");
  redirect("/admin/servicios");
}

export async function updateService(serviceId: string, formData: FormData) {
  const session = await requireCan("INFRAESTRUCTURA", "editar");

  const leido = leerServicio(formData);
  if ("error" in leido) return { error: leido.error };

  const r = await actualizarServicio(session.user, serviceId, leido.data);
  if (!r.ok) return { error: r.error };

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
