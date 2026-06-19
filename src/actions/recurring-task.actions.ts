"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import {
  computeNextRunAt,
  serializeDaysOfWeek,
} from "@/lib/recurrence";
import type { RecurrenceFrequency } from "@/generated/prisma";

const schema = z.object({
  title: z.string().min(1, "Título requerido").max(200),
  description: z.string().min(1, "Descripción requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  category: z.string().optional(),
  estimatedHours: z.number().optional(),
  checklist: z.array(z.string().min(1).max(500)).max(100).optional(),
  projectId: z.string().optional(),
  assignedToId: z.string().optional(),
  frequency: z.enum(["DIARIA", "SEMANAL", "MENSUAL"]),
  interval: z.number().int().min(1).max(365),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(-1).max(31).optional(),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().optional(),
  dueDateOffsetDays: z.number().int().min(0).max(365),
  isActive: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

function parseFormData(formData: FormData): Input {
  const daysRaw = formData.getAll("daysOfWeek").map((v) => parseInt(String(v), 10)).filter((n) => !isNaN(n));
  const estimatedHoursRaw = formData.get("estimatedHours");
  const projectIdRaw = formData.get("projectId");
  const assignedToIdRaw = formData.get("assignedToId");
  const categoryRaw = formData.get("category");
  const endDateRaw = formData.get("endDate");
  const dayOfMonthRaw = formData.get("dayOfMonth");
  const checklistRaw = formData.get("checklist");

  let checklist: string[] | undefined;
  if (checklistRaw) {
    try {
      const parsed = JSON.parse(String(checklistRaw));
      if (Array.isArray(parsed)) {
        checklist = parsed.map((v) => String(v).trim()).filter((v) => v.length > 0);
      }
    } catch {
      checklist = undefined;
    }
  }

  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    priority: String(formData.get("priority") ?? "MEDIA") as Input["priority"],
    category: categoryRaw ? String(categoryRaw).trim() || undefined : undefined,
    estimatedHours: estimatedHoursRaw ? Number(estimatedHoursRaw) || undefined : undefined,
    checklist,
    projectId: projectIdRaw ? String(projectIdRaw) || undefined : undefined,
    assignedToId: assignedToIdRaw ? String(assignedToIdRaw) || undefined : undefined,
    frequency: String(formData.get("frequency") ?? "DIARIA") as RecurrenceFrequency,
    interval: parseInt(String(formData.get("interval") ?? "1"), 10),
    daysOfWeek: daysRaw,
    dayOfMonth: dayOfMonthRaw ? parseInt(String(dayOfMonthRaw), 10) : undefined,
    startDate: String(formData.get("startDate") ?? ""),
    endDate: endDateRaw ? String(endDateRaw) || undefined : undefined,
    dueDateOffsetDays: parseInt(String(formData.get("dueDateOffsetDays") ?? "0"), 10),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

function toDateLocal(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export async function createRecurringTemplate(formData: FormData) {
  const session = await requireRole(["ADMINISTRADOR"]);
  const raw = parseFormData(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const startDate = toDateLocal(data.startDate);
  const endDate = data.endDate ? toDateLocal(data.endDate) : null;
  const daysSerialized = data.daysOfWeek && data.daysOfWeek.length > 0 ? serializeDaysOfWeek(data.daysOfWeek) : null;

  const created = await prisma.recurringTaskTemplate.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category || null,
      estimatedHours: data.estimatedHours ?? null,
      checklist: data.checklist ?? [],
      projectId: data.projectId || null,
      assignedToId: data.assignedToId || null,
      createdById: session.user.id,
      frequency: data.frequency,
      interval: data.interval,
      daysOfWeek: daysSerialized,
      dayOfMonth: data.frequency === "MENSUAL" ? (data.dayOfMonth ?? null) : null,
      startDate,
      endDate,
      nextRunAt: startDate,
      isActive: data.isActive ?? true,
      dueDateOffsetDays: data.dueDateOffsetDays,
    },
  });

  revalidatePath("/admin/tareas-recurrentes");
  redirect(`/admin/tareas-recurrentes/${created.id}/edit`);
}

export async function updateRecurringTemplate(id: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);
  const raw = parseFormData(formData);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const existing = await prisma.recurringTaskTemplate.findUnique({ where: { id } });
  if (!existing) return { error: "Plantilla no encontrada" };

  const startDate = toDateLocal(data.startDate);
  const endDate = data.endDate ? toDateLocal(data.endDate) : null;
  const daysSerialized = data.daysOfWeek && data.daysOfWeek.length > 0 ? serializeDaysOfWeek(data.daysOfWeek) : null;

  const patternChanged =
    existing.frequency !== data.frequency ||
    existing.interval !== data.interval ||
    existing.daysOfWeek !== daysSerialized ||
    (existing.dayOfMonth ?? null) !== (data.dayOfMonth ?? null) ||
    existing.startDate.getTime() !== startDate.getTime();

  let nextRunAt = existing.nextRunAt;
  if (patternChanged) {
    nextRunAt = startDate.getTime() > Date.now() ? startDate : startDate;
  }

  await prisma.recurringTaskTemplate.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      category: data.category || null,
      estimatedHours: data.estimatedHours ?? null,
      checklist: data.checklist ?? [],
      projectId: data.projectId || null,
      assignedToId: data.assignedToId || null,
      frequency: data.frequency,
      interval: data.interval,
      daysOfWeek: daysSerialized,
      dayOfMonth: data.frequency === "MENSUAL" ? (data.dayOfMonth ?? null) : null,
      startDate,
      endDate,
      nextRunAt,
      isActive: data.isActive ?? existing.isActive,
      dueDateOffsetDays: data.dueDateOffsetDays,
    },
  });

  revalidatePath("/admin/tareas-recurrentes");
  revalidatePath(`/admin/tareas-recurrentes/${id}/edit`);
  return { ok: true };
}

export async function toggleRecurringActive(id: string) {
  await requireRole(["ADMINISTRADOR"]);
  const existing = await prisma.recurringTaskTemplate.findUnique({ where: { id }, select: { isActive: true } });
  if (!existing) return { error: "Plantilla no encontrada" };
  await prisma.recurringTaskTemplate.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });
  revalidatePath("/admin/tareas-recurrentes");
  return { ok: true };
}

export async function deleteRecurringTemplate(id: string) {
  await requireRole(["ADMINISTRADOR"]);
  await prisma.recurringTaskTemplate.delete({ where: { id } });
  revalidatePath("/admin/tareas-recurrentes");
  redirect("/admin/tareas-recurrentes");
}

export async function runRecurringNow(id: string) {
  const session = await requireRole(["ADMINISTRADOR"]);
  const tpl = await prisma.recurringTaskTemplate.findUnique({ where: { id } });
  if (!tpl) return { error: "Plantilla no encontrada" };
  if (!tpl.isActive) return { error: "La plantilla está pausada" };

  const now = new Date();
  const due = tpl.dueDateOffsetDays > 0
    ? new Date(now.getTime() + tpl.dueDateOffsetDays * 86400000)
    : null;

  await prisma.$transaction(async (tx) => {
    const projectId = tpl.projectId;
    let nextNumber = 0;
    if (projectId) {
      const last = await tx.task.findFirst({
        where: { projectId, number: { gt: 0 } },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      nextNumber = (last?.number ?? 0) + 1;
    }

    await tx.task.create({
      data: {
        title: tpl.title,
        description: tpl.description,
        priority: tpl.priority,
        category: tpl.category,
        estimatedHours: tpl.estimatedHours,
        projectId: tpl.projectId,
        assignedToId: tpl.assignedToId,
        createdById: session.user.id,
        recurringTemplateId: tpl.id,
        dueDate: due,
        number: nextNumber,
        checklistItems: tpl.checklist.length
          ? {
              create: tpl.checklist.map((title, position) => ({
                title,
                position,
                createdById: session.user.id,
              })),
            }
          : undefined,
      },
    });

    const nextRun = computeNextRunAt(now, {
      frequency: tpl.frequency,
      interval: tpl.interval,
      daysOfWeek: tpl.daysOfWeek,
      dayOfMonth: tpl.dayOfMonth,
    });

    await tx.recurringTaskTemplate.update({
      where: { id: tpl.id },
      data: { lastRunAt: now, nextRunAt: nextRun },
    });
  });

  revalidatePath("/admin/tareas-recurrentes");
  return { ok: true };
}

