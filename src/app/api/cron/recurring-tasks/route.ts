import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeNextRunAt } from "@/lib/recurrence";

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
  });

  let generated = 0;
  const errors: { id: string; message: string }[] = [];

  for (const tpl of templates) {
    try {
      const due = tpl.dueDateOffsetDays > 0
        ? new Date(now.getTime() + tpl.dueDateOffsetDays * 86400000)
        : null;

      await prisma.$transaction(async (tx) => {
        let nextNumber = 0;
        if (tpl.projectId) {
          const last = await tx.task.findFirst({
            where: { projectId: tpl.projectId, number: { gt: 0 } },
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
            createdById: tpl.createdById,
            recurringTemplateId: tpl.id,
            dueDate: due,
            number: nextNumber,
            checklistItems: tpl.checklist.length
              ? {
                  create: tpl.checklist.map((title, position) => ({
                    title,
                    position,
                    createdById: tpl.createdById,
                  })),
                }
              : undefined,
          },
        });

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
      });

      generated++;
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
