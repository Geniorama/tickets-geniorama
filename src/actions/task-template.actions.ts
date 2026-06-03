"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";

const templateSchema = z.object({
  name:           z.string().min(1, "El nombre es requerido").max(120),
  title:          z.string().min(1, "El título es requerido").max(200),
  description:    z.string().min(1, "La descripción es requerida"),
  priority:       z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  category:       z.string().optional(),
  estimatedHours: z.string().optional(),
});

function parseChecklist(formData: FormData): string[] {
  const raw = formData.get("checklist") as string | null;
  if (!raw) return [];
  try {
    const items = JSON.parse(raw) as unknown[];
    return items
      .map((i) => (typeof i === "string" ? i.trim() : ""))
      .filter((i): i is string => i.length > 0);
  } catch {
    return [];
  }
}

function parseForm(formData: FormData) {
  return templateSchema.safeParse({
    name:           formData.get("name"),
    title:          formData.get("title"),
    description:    formData.get("description"),
    priority:       formData.get("priority")       || "MEDIA",
    category:       formData.get("category")       || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
  });
}

export async function createTaskTemplate(formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.taskTemplate.create({
    data: {
      name:           parsed.data.name,
      title:          parsed.data.title,
      description:    parsed.data.description,
      priority:       parsed.data.priority,
      category:       parsed.data.category ?? null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
      checklist:      parseChecklist(formData),
      createdById:    session.user.id,
    },
  });

  revalidatePath("/tareas/plantillas");
  redirect("/tareas/plantillas");
}

export async function updateTaskTemplate(id: string, formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.taskTemplate.update({
    where: { id },
    data: {
      name:           parsed.data.name,
      title:          parsed.data.title,
      description:    parsed.data.description,
      priority:       parsed.data.priority,
      category:       parsed.data.category ?? null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
      checklist:      parseChecklist(formData),
    },
  });

  revalidatePath("/tareas/plantillas");
  redirect("/tareas/plantillas");
}

export async function deleteTaskTemplate(id: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.taskTemplate.delete({ where: { id } });
  revalidatePath("/tareas/plantillas");
  return {};
}

/** Crea una tarea global directamente a partir de una plantilla (acción rápida). */
export async function createTaskFromTemplate(templateId: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const tpl = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
  if (!tpl) return { error: "Plantilla no encontrada" };

  const task = await prisma.task.create({
    data: {
      number:         0, // tarea global (sin proyecto)
      title:          tpl.title,
      description:    tpl.description,
      priority:       tpl.priority,
      category:       tpl.category,
      estimatedHours: tpl.estimatedHours,
      createdById:    session.user.id,
      checklistItems: tpl.checklist.length
        ? { create: tpl.checklist.map((title, position) => ({ title, position, createdById: session.user.id })) }
        : undefined,
    },
  });

  revalidatePath("/tareas");
  redirect(`/tareas/${task.id}`);
}
