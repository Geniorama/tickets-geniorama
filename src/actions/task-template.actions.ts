"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createTemplate, deleteTemplate, findTemplate, updateTemplate } from "@/lib/templates";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { combineEstimatedTime } from "@/lib/estimated-time";
import { normalizeChecklistGroups, parseChecklistGroups } from "@/lib/checklist";
import { createChecklistGroups } from "@/lib/checklists";

const templateSchema = z.object({
  name:           z.string().min(1, "El nombre es requerido").max(120),
  title:          z.string().min(1, "El título es requerido").max(200),
  description:    z.string().min(1, "La descripción es requerida"),
  priority:       z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  category:       z.string().optional(),
  estimatedHours: z.string().optional(),
  estimatedMinutes: z.string().optional(),
});

function parseForm(formData: FormData) {
  return templateSchema.safeParse({
    name:           formData.get("name"),
    title:          formData.get("title"),
    description:    formData.get("description"),
    priority:       formData.get("priority")       || "MEDIA",
    category:       formData.get("category")       || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    estimatedMinutes: formData.get("estimatedMinutes") || undefined,
  });
}

export async function createTaskTemplate(formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await createTemplate("TASK", {
      name:           parsed.data.name,
      title:          parsed.data.title,
      description:    parsed.data.description,
      priority:       parsed.data.priority,
      category:       parsed.data.category ?? null,
      estimatedHours: combineEstimatedTime(parsed.data.estimatedHours, parsed.data.estimatedMinutes),
      checklist:      parseChecklistGroups(formData.get("checklist")),
      createdById:    session.user.id,
  });

  revalidatePath("/tareas/plantillas");
  redirect("/tareas/plantillas");
}

export async function updateTaskTemplate(id: string, formData: FormData): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await updateTemplate("TASK", id, {
      name:           parsed.data.name,
      title:          parsed.data.title,
      description:    parsed.data.description,
      priority:       parsed.data.priority,
      category:       parsed.data.category ?? null,
      estimatedHours: combineEstimatedTime(parsed.data.estimatedHours, parsed.data.estimatedMinutes),
      checklist:      parseChecklistGroups(formData.get("checklist")),
  });

  revalidatePath("/tareas/plantillas");
  redirect("/tareas/plantillas");
}

export async function deleteTaskTemplate(id: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await deleteTemplate("TASK", id);
  revalidatePath("/tareas/plantillas");
  return {};
}

/** Crea una tarea global directamente a partir de una plantilla (acción rápida). */
export async function createTaskFromTemplate(templateId: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const tpl = await findTemplate("TASK", templateId);
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
    },
  });

  await createChecklistGroups(
    { entityType: "TASK", entityId: task.id },
    normalizeChecklistGroups(tpl.checklist),
    session.user.id,
  );

  revalidatePath("/tareas");
  redirect(`/tareas/${task.id}`);
}
