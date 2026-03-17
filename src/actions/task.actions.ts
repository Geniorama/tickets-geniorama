"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff, isAdmin } from "@/lib/auth-helpers";
import { validateFile, uploadFile, deleteFile } from "@/lib/s3";
import type { TaskStatus } from "@/generated/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { notify, notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";

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
  startTime:      z.string().optional(),
  dueDate:        z.string().optional(),
  endTime:        z.string().optional(),
  estimatedHours: z.string().optional(),
  force:          z.boolean().default(false), // omitir verificación de conflictos
});

// ─── createTask ───────────────────────────────────────────────────────────────

export async function createTask(projectIdArg: string | null, formData: FormData) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const projectId = projectIdArg ?? (formData.get("projectId") as string | null) ?? "";
  if (!projectId) return { error: "Debes seleccionar un proyecto" };

  const parsed = taskSchema.safeParse({
    title:          formData.get("title"),
    description:    formData.get("description"),
    status:         formData.get("status")         || "PENDIENTE",
    priority:       formData.get("priority")       || "MEDIA",
    category:       formData.get("category")       || undefined,
    assignedToId:   formData.get("assignedToId")   || undefined,
    startDate:      formData.get("startDate")      || undefined,
    startTime:      formData.get("startTime")      || undefined,
    dueDate:        formData.get("dueDate")         || undefined,
    endTime:        formData.get("endTime")         || undefined,
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

  const task = await prisma.$transaction(async (tx) => {
    const count = await tx.task.count({ where: { projectId } });
    return tx.task.create({
      data: {
        number:         count + 1,
        title:          parsed.data.title,
        description:    parsed.data.description,
        status:         parsed.data.status,
        priority:       parsed.data.priority,
        category:       parsed.data.category       ?? null,
        projectId,
        assignedToId:   parsed.data.assignedToId   ?? null,
        createdById:    session.user.id,
        startDate:      parsed.data.startDate      ? new Date(parsed.data.startDate) : null,
        startTime:      parsed.data.startTime      ?? null,
        dueDate:        parsed.data.dueDate         ? new Date(parsed.data.dueDate)   : null,
        endTime:        parsed.data.endTime         ?? null,
        estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
      },
    });
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

  const linksRaw = formData.get("links") as string | null;
  if (linksRaw) {
    try {
      const linksList = JSON.parse(linksRaw) as { url: string; label: string }[];
      for (const { url, label } of linksList) {
        if (!url) continue;
        await prisma.taskAttachment.create({
          data: { taskId: task.id, uploadedById: session.user.id, fileName: label || url, fileUrl: url, storagePath: "link" },
        });
      }
    } catch { /* JSON inválido, ignorar */ }
  }

  const [project, assignee] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
    task.assignedToId
      ? prisma.user.findUnique({ where: { id: task.assignedToId }, select: { name: true } })
      : null,
  ]);

  // Construir mensaje enriquecido para GChat
  const msgParts: string[] = [`"${task.title}"${project ? ` en ${project.name}` : ""}`];
  if (assignee?.name) msgParts.push(`Asignado a: ${assignee.name}`);
  if (task.dueDate) msgParts.push(`Vence: ${fmt(task.dueDate)}`);

  // Notificar creación de tarea al webhook (sin destinatario en-app)
  await sendGChatNotification(
    "task_new",
    "Nueva tarea",
    msgParts.join(" · "),
    `/proyectos/${projectId}/tareas/${task.id}`
  );

  // Notificar al asignado si no es el creador
  if (task.assignedToId && task.assignedToId !== session.user.id) {
    await notify(
      task.assignedToId,
      "task_assigned",
      "Tarea asignada",
      `Se te asignó: "${task.title}"${project ? ` en ${project.name}` : ""}`,
      `/proyectos/${projectId}/tareas/${task.id}`
    );
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
    startTime:      formData.get("startTime")      || undefined,
    dueDate:        formData.get("dueDate")         || undefined,
    endTime:        formData.get("endTime")         || undefined,
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

  const oldTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { assignedToId: true, createdById: true, title: true, startDate: true, dueDate: true },
  });

  const newStartDate = parsed.data.startDate ? new Date(parsed.data.startDate) : null;
  const newDueDate   = parsed.data.dueDate   ? new Date(parsed.data.dueDate)   : null;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title:          parsed.data.title,
      description:    parsed.data.description,
      status:         parsed.data.status,
      priority:       parsed.data.priority,
      category:       parsed.data.category       ?? null,
      assignedToId:   parsed.data.assignedToId   ?? null,
      startDate:      newStartDate,
      startTime:      parsed.data.startTime      ?? null,
      dueDate:        newDueDate,
      endTime:        parsed.data.endTime         ?? null,
      estimatedHours: parsed.data.estimatedHours ? parseFloat(parsed.data.estimatedHours) : null,
    },
  });

  // Notificar al nuevo asignado si cambió y no es quien edita
  const newAssigneeId = parsed.data.assignedToId ?? null;
  if (newAssigneeId && newAssigneeId !== oldTask?.assignedToId && newAssigneeId !== session.user.id) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });
    await notify(
      newAssigneeId,
      "task_assigned",
      "Tarea asignada",
      `Se te asignó: "${parsed.data.title}"${project ? ` en ${project.name}` : ""}`,
      `/proyectos/${projectId}/tareas/${taskId}`
    );
  }

  // Notificar cambio de fechas
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "Sin fecha";

  const startChanged = newStartDate?.toDateString() !== oldTask?.startDate?.toDateString();
  const dueChanged   = newDueDate?.toDateString()   !== oldTask?.dueDate?.toDateString();

  if (startChanged || dueChanged) {
    const recipients = [oldTask?.createdById, oldTask?.assignedToId ?? newAssigneeId]
      .filter((id): id is string => !!id && id !== session.user.id);
    const parts: string[] = [];
    if (startChanged) parts.push(`Inicio: ${fmt(newStartDate)}`);
    if (dueChanged)   parts.push(`Límite: ${fmt(newDueDate)}`);
    await notifyMany(
      recipients,
      "task_date_changed",
      "Fechas actualizadas",
      `"${parsed.data.title}" — ${parts.join(" · ")}`,
      `/proyectos/${projectId}/tareas/${taskId}`
    );
  }

  // Borrar adjuntos marcados para eliminar
  const deletedIdsRaw = formData.get("deletedAttachmentIds") as string | null;
  if (deletedIdsRaw) {
    try {
      const ids = JSON.parse(deletedIdsRaw) as string[];
      for (const id of ids) {
        const att = await prisma.taskAttachment.findUnique({ where: { id }, select: { storagePath: true } });
        if (!att) continue;
        if (att.storagePath && att.storagePath !== "link") {
          try { await deleteFile(att.storagePath); } catch { /* continuar */ }
        }
        await prisma.taskAttachment.delete({ where: { id } });
      }
    } catch { /* JSON inválido */ }
  }

  // Subir nuevos archivos
  const files = formData.getAll("files") as File[];
  for (const file of files) {
    if (file.size === 0) continue;
    if (validateFile(file)) continue;
    try {
      const { storagePath, fileUrl } = await uploadFile(file, taskId);
      await prisma.taskAttachment.create({
        data: { taskId, uploadedById: session.user.id, fileName: file.name, fileUrl, storagePath },
      });
    } catch { /* continuar */ }
  }

  // Agregar nuevos enlaces
  const linksRaw = formData.get("links") as string | null;
  if (linksRaw) {
    try {
      const linksList = JSON.parse(linksRaw) as { url: string; label: string }[];
      for (const { url, label } of linksList) {
        if (!url) continue;
        await prisma.taskAttachment.create({
          data: { taskId, uploadedById: session.user.id, fileName: label || url, fileUrl: url, storagePath: "link" },
        });
      }
    } catch { /* JSON inválido */ }
  }

  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  redirect(`/proyectos/${projectId}/tareas/${taskId}`);
}

// ─── updateTaskStatus ─────────────────────────────────────────────────────────

export async function updateTaskStatus(taskId: string, projectId: string, status: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const oldTask = await prisma.task.findUnique({
    where: { id: taskId },
    select: { title: true, status: true, createdById: true, assignedToId: true },
  });

  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as TaskStatus },
  });

  // Notificar tarea completada si es un cambio nuevo a COMPLETADO
  if (status === "COMPLETADO" && oldTask?.status !== "COMPLETADO") {
    const recipients = [oldTask?.createdById, oldTask?.assignedToId]
      .filter((id): id is string => !!id && id !== session.user.id);
    await notifyMany(
      recipients,
      "task_completed",
      "Tarea completada",
      `"${oldTask?.title}" marcada como completada`,
      `/proyectos/${projectId}/tareas/${taskId}`
    );
  }

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

// ─── moveTask ─────────────────────────────────────────────────────────────────

export async function moveTask(taskId: string, fromProjectId: string, toProjectId: string) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  const maxTask = await prisma.task.findFirst({
    where: { projectId: toProjectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const newNumber = (maxTask?.number ?? 0) + 1;

  await prisma.task.update({
    where: { id: taskId },
    data: { projectId: toProjectId, number: newNumber },
  });

  revalidatePath(`/proyectos/${fromProjectId}`);
  revalidatePath(`/proyectos/${toProjectId}`);
  redirect(`/proyectos/${toProjectId}/tareas/${taskId}`);
}
