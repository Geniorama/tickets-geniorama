import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendGChatNotification } from "@/lib/gchat";
import { fromZonedTime } from "date-fns-tz";
import { formatDate } from "@/lib/format-date";

export const maxDuration = 30;

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
      take: 50,
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
        project: { isPrivate: false },
      },
      take: 50,
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

  // Enviar notificaciones en paralelo (batches de 5 para no saturar)
  const ticketNotifications = overdueTickets.map((ticket) => {
    const assignedName = ticket.assignedTo?.name ?? "Sin asignar";
    const parts = [
      `👤 ${assignedName}`,
      `📅 Vencido: ${formatDate(ticket.dueDate!)}`,
      `Prioridad: ${PRIORITY_LABEL[ticket.priority] ?? ticket.priority}`,
    ];
    return () => sendGChatNotification(
      "ticket_overdue",
      "Ticket vencido",
      `"${ticket.title}" · ${parts.join(" · ")}`,
      `/tickets/${ticket.id}`,
    );
  });

  const taskNotifications = overdueTasks.map((task) => {
    const assignedName = task.assignedTo?.name ?? "Sin asignar";
    const parts = [
      task.project ? `Proyecto: ${task.project.name}` : null,
      `👤 ${assignedName}`,
      `📅 Vencido: ${formatDate(task.dueDate!)}`,
      `Prioridad: ${PRIORITY_LABEL[task.priority] ?? task.priority}`,
    ].filter(Boolean);
    return () => sendGChatNotification(
      "task_overdue",
      "Tarea vencida",
      `"${task.title}" · ${parts.join(" · ")}`,
      `/proyectos/${task.projectId}/tareas/${task.id}`,
    );
  });

  const allNotifications = [...ticketNotifications, ...taskNotifications];
  const BATCH_SIZE = 5;
  for (let i = 0; i < allNotifications.length; i += BATCH_SIZE) {
    await Promise.all(allNotifications.slice(i, i + BATCH_SIZE).map((fn) => fn()));
  }

  return NextResponse.json({
    ok: true,
    tickets: overdueTickets.length,
    tasks:   overdueTasks.length,
  });
}
