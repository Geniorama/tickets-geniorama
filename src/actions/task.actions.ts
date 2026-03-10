"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { validateFile, uploadFile } from "@/lib/s3";
import type { TaskStatus } from "@/generated/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type TaskConflict = {
  taskId: string;
  taskTitle: string;
  projectName: string;
  startDate: string | null;
  dueDate: string | null;
};

// ─── Helper: detectar solapamientos ──────────────────────────────────────────

function fmt(d: Date) {
  return format(d, "d MMM yyyy", { locale: es });
}

async function findScheduleConflicts(
  assignedToId: string,
  startDate: Date | null,
  dueDate: Date | null,
  excludeTaskId?: string
): Promise<TaskConflict[]> {
  // Solo verificar si hay al menos una fecha definida
  if (!startDate && !dueDate) return [];

  // Rango efectivo de la tarea propuesta
  const rangeStart = startDate ?? dueDate!;
  const rangeEnd   = dueDate   ?? startDate!;

  const overlapping = await prisma.task.findMany({
    where: {
      assignedToId,
      status: { not: "COMPLETADO" }, // tareas completadas no generan conflicto
      ...(excludeTaskId ? { id: { not: excludeTaskId } } : {}),
      // Condición de solapamiento: startA <= rangeEnd AND dueA >= rangeStart
      AND: [
        {
          OR: [
            { startDate: { lte: rangeEnd } },
            { dueDate:   { lte: rangeEnd } },
          ],
        },
        {
          OR: [
            { dueDate:   { gte: rangeStart } },
            { startDate: { gte: rangeStart } },
          ],
        },
      ],
      // Al menos una fecha definida en la tarea existente
      OR: [
        { startDate: { not: null } },
        { dueDate:   { not: null } },
      ],
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      dueDate: true,
      project: { select: { name: true } },
    },
  });

  return overlapping.map((t) => ({
    taskId:      t.id,
    taskTitle:   t.title,
    projectName: t.project.name,
    startDate:   t.startDate ? fmt(t.startDate) : null,
    dueDate:     t.dueDate   ? fmt(t.dueDate)   : null,
  }));
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const taskSchema = z.object({
  title:          z.string().min(1, "El título es requerido"),
  description:    z.string().min(1, "La descripción es requerida"),
  status:         z.enum(["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"]).default("PENDIENTE"),
  priority:       z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  category:       z.string().optional(),
  assignedToId:   z.string().optional(),
  startDate:      z.string().optional(),
  dueDate:        z.string().optional(),
  estimatedHours: z.string().optional(),
  force:          z.boolean().default(false), // omitir verificación de conflictos
});

// ─── createTask ───────────────────────────────────────────────────────────────

export async function createTask(projectId: string, formData: FormData) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = taskSchema.safeParse({
    title:          formData.get("title"),
    description:    formData.get("description"),
    status:         formData.get("status")         || "PENDIENTE",
    priority:       formData.get("priority")       || "MEDIA",
    category:       formData.get("category")       || undefined,
    assignedToId:   formData.get("assignedToId")   || undefined,
    startDate:      formData.get("startDate")      || undefined,
    dueDate:        formData.get("dueDate")         || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    force:          formData.get("force") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };

    // Verificar conflictos de horario (solo si hay fechas y no se forzó)
    if (!parsed.data.force) {
      const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
      const dueDate   = parsed.data.dueDate   ? new Date(parsed.data.dueDate)   : null;
      const conflicts = await findScheduleConflicts(parsed.data.assignedToId, startDate, dueDate);
      if (conflicts.length > 0) return { conflicts };
    }
  }

  const task = await prisma.task.create({
    data: {
      title:          parsed.data.title,
      description:    parsed.data.description,
      status:         parsed.data.status,
      priority:       parsed.data.priority,
      category:       parsed.data.category       ?? null,
      projectId,
      assignedToId:   parsed.data.assignedToId   ?? null,
      createdById:    session.user.id,
      startDate:      parsed.data.startDate      ? new Date(parsed.data.startDate) : null,
      dueDate:        parsed.data.dueDate         ? new Date(parsed.data.dueDate)   : null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
    },
  });

  const files = formData.getAll("files") as File[];
  for (const file of files) {
    if (file.size === 0) continue;
    if (validateFile(file)) continue;
    try {
      const { storagePath, fileUrl } = await uploadFile(file, task.id);
      await prisma.taskAttachment.create({
        data: { taskId: task.id, uploadedById: session.user.id, fileName: file.name, fileUrl, storagePath },
      });
    } catch { /* continuar aunque falle un archivo */ }
  }

  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}/tareas/${task.id}`);
}

// ─── updateTask ───────────────────────────────────────────────────────────────

export async function updateTask(taskId: string, projectId: string, formData: FormData) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = taskSchema.safeParse({
    title:          formData.get("title"),
    description:    formData.get("description"),
    status:         formData.get("status")         || "PENDIENTE",
    priority:       formData.get("priority")       || "MEDIA",
    category:       formData.get("category")       || undefined,
    assignedToId:   formData.get("assignedToId")   || undefined,
    startDate:      formData.get("startDate")      || undefined,
    dueDate:        formData.get("dueDate")         || undefined,
    estimatedHours: formData.get("estimatedHours") || undefined,
    force:          formData.get("force") === "true",
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };

    if (!parsed.data.force) {
      const startDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
      const dueDate   = parsed.data.dueDate   ? new Date(parsed.data.dueDate)   : null;
      const conflicts = await findScheduleConflicts(parsed.data.assignedToId, startDate, dueDate, taskId);
      if (conflicts.length > 0) return { conflicts };
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title:          parsed.data.title,
      description:    parsed.data.description,
      status:         parsed.data.status,
      priority:       parsed.data.priority,
      category:       parsed.data.category       ?? null,
      assignedToId:   parsed.data.assignedToId   ?? null,
      startDate:      parsed.data.startDate      ? new Date(parsed.data.startDate) : null,
      dueDate:        parsed.data.dueDate         ? new Date(parsed.data.dueDate)   : null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
    },
  });

  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  redirect(`/proyectos/${projectId}/tareas/${taskId}`);
}

// ─── updateTaskStatus ─────────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, projectId: string, status: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as TaskStatus },
  });

  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  return { success: true };
}

// ─── deleteTask ───────────────────────────────────────────────────────────────

export async function deleteTask(taskId: string, projectId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}`);
}
