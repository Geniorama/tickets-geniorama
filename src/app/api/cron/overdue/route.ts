import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGChatNotification } from "@/lib/gchat";
import { fromZonedTime } from "date-fns-tz";
import { formatDate } from "@/lib/format-date";

const TZ = "America/Bogota";

const PRIORITY_LABEL: Record<string, string> = {
  BAJA:    "Baja",
  MEDIA:   "Media",
  ALTA:    "Alta",
  CRITICA: "Crítica",
};

export async function POST(req: NextRequest) {
  // Protección opcional: si existe CRON_SECRET en env, se exige como Bearer token
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const bogotaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const today = fromZonedTime(`${bogotaDateStr}T00:00:00`, TZ);

  const [overdueTickets, overdueTasks] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        status: { notIn: ["CERRADO", "EN_REVISION"] },
        dueDate: { lt: today },
      },
      select: {
        id:         true,
        title:      true,
        dueDate:    true,
        priority:   true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: {
        status: { notIn: ["COMPLETADO", "EN_REVISION"] },
        dueDate: { lt: today },
      },
      select: {
        id:         true,
        title:      true,
        dueDate:    true,
        priority:   true,
        projectId:  true,
        assignedTo: { select: { name: true } },
        project:    { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  // Un mensaje por ticket vencido
  for (const ticket of overdueTickets) {
    const assignedName = ticket.assignedTo?.name ?? "Sin asignar";
    const parts = [
      `👤 ${assignedName}`,
      `📅 Vencido: ${formatDate(ticket.dueDate!)}`,
      `Prioridad: ${PRIORITY_LABEL[ticket.priority] ?? ticket.priority}`,
    ];
    await sendGChatNotification(
      "ticket_overdue",
      "Ticket vencido",
      `"${ticket.title}" · ${parts.join(" · ")}`,
      `/tickets/${ticket.id}`,
    );
  }

  // Un mensaje por tarea vencida
  for (const task of overdueTasks) {
    const assignedName = task.assignedTo?.name ?? "Sin asignar";
    const parts = [
      task.project ? `Proyecto: ${task.project.name}` : null,
      `👤 ${assignedName}`,
      `📅 Vencido: ${formatDate(task.dueDate!)}`,
      `Prioridad: ${PRIORITY_LABEL[task.priority] ?? task.priority}`,
    ].filter(Boolean);
    await sendGChatNotification(
      "task_overdue",
      "Tarea vencida",
      `"${task.title}" · ${parts.join(" · ")}`,
      `/proyectos/${task.projectId}/tareas/${task.id}`,
    );
  }

  return NextResponse.json({
    ok: true,
    tickets: overdueTickets.length,
    tasks:   overdueTasks.length,
  });
}
