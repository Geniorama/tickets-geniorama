import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/recurrence";
import { normalizeChecklistGroups } from "@/lib/checklist";
import { createChecklistGroups } from "@/lib/checklists";
import { sendGChatNotification } from "@/lib/gchat";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  const templates = await prisma.recurringTaskTemplate.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    take: 200,
    include: {
      // Para el aviso: el nombre del proyecto y de quién la recibe, y si el
      // proyecto es privado —lo privado no sale al canal del equipo.
      project: { select: { id: true, name: true, isPrivate: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });

  let generated = 0;
  const errors: { id: string; message: string }[] = [];

  for (const tpl of templates) {
    try {
      const due = tpl.dueDateOffsetDays > 0
        ? new Date(now.getTime() + tpl.dueDateOffsetDays * 86400000)
        : null;

      const creada = await prisma.$transaction(async (tx) => {
        let nextNumber = 0;
        if (tpl.projectId) {
          const last = await tx.task.findFirst({
            where: { projectId: tpl.projectId, number: { gt: 0 } },
            orderBy: { number: "desc" },
            select: { number: true },
          });
          nextNumber = (last?.number ?? 0) + 1;
        }

        const task = await tx.task.create({
          data: {
            title: tpl.title,
            description: tpl.description,
            priority: tpl.priority,
            category: tpl.category,
            estimatedHours: tpl.estimatedHours,
            projectId: tpl.projectId,
            assignedToId: tpl.assignedToId,
            createdById: tpl.createdById,
            recurringTemplateId: tpl.id,
            dueDate: due,
            number: nextNumber,
          },
        });

        await createChecklistGroups(
          { entityType: "TASK", entityId: task.id },
          normalizeChecklistGroups(tpl.checklist),
          tpl.createdById,
          tx,
        );

        let nextRun = computeNextRunAt(tpl.nextRunAt, {
          frequency: tpl.frequency,
          interval: tpl.interval,
          daysOfWeek: tpl.daysOfWeek,
          dayOfMonth: tpl.dayOfMonth,
        });

        while (nextRun.getTime() <= now.getTime()) {
          nextRun = computeNextRunAt(nextRun, {
            frequency: tpl.frequency,
            interval: tpl.interval,
            daysOfWeek: tpl.daysOfWeek,
            dayOfMonth: tpl.dayOfMonth,
          });
        }

        await tx.recurringTaskTemplate.update({
          where: { id: tpl.id },
          data: { lastRunAt: now, nextRunAt: nextRun },
        });

        return {
          id: task.id,
          url: tpl.projectId
            ? `/proyectos/${tpl.projectId}/tareas/${task.id}`
            : `/tareas/${task.id}`,
        };
      });

      generated++;

      // Los avisos van **fuera** de la transacción y después de que confirme:
      // anunciar en Google Chat una tarea que luego revierte es peor que no
      // anunciarla. Y van aquí porque el cron era el único camino de creación
      // que no avisaba a nadie: la tarea aparecía en silencio.
      if (creada) {
        const partes: string[] = [
          `"${tpl.title}"${tpl.project ? ` en ${tpl.project.name}` : ""}`,
        ];
        if (tpl.assignedTo?.name) partes.push(`Asignado a: ${tpl.assignedTo.name}`);
        if (due) partes.push(`Vence: ${format(due, "d MMM yyyy", { locale: es })}`);

        // Mismo criterio que la creación manual: lo de un proyecto privado no
        // se cuenta en el canal del equipo.
        if (!tpl.project?.isPrivate) {
          await sendGChatNotification(
            "task_new",
            "Nueva tarea recurrente",
            partes.join(" · "),
            creada.url,
          ).catch(() => {});
        }

        // Y a quien la recibe: campana, su webhook personal y push. Con
        // `skipGChat` porque el canal del equipo ya se enteró arriba.
        if (tpl.assignedToId) {
          await notify(
            tpl.assignedToId,
            "task_assigned",
            "Tarea recurrente asignada",
            `Se te asignó: "${tpl.title}"${tpl.project ? ` en ${tpl.project.name}` : ""}`,
            creada.url,
            true,
          ).catch(() => {});
        }
      }
    } catch (e) {
      errors.push({ id: tpl.id, message: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: templates.length,
    generated,
    errors,
  });
}
