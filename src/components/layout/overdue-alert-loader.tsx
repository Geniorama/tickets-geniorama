import { prisma } from "@/lib/prisma";
import { OverdueAlert } from "./overdue-alert";
import type { OverdueItem } from "./overdue-alert";
import { fromZonedTime } from "date-fns-tz";

const TZ = "America/Bogota";

export async function OverdueAlertLoader({ userId }: { userId: string }) {
  const bogotaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const today = fromZonedTime(`${bogotaDateStr}T00:00:00`, TZ);

  const [overdueTickets, overdueTasks] = await Promise.all([
    prisma.ticket.findMany({
      where: {
        assignedToId: userId,
        status: { not: "CERRADO" },
        dueDate: { lt: today },
      },
      take: 50,
      select: { id: true, title: true, dueDate: true, status: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: "COMPLETADO" },
        dueDate: { lt: today },
      },
      take: 50,
      select: { id: true, title: true, dueDate: true, status: true, projectId: true },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const overdueItems: OverdueItem[] = [
    ...overdueTickets.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      type: "ticket" as const,
      inReview: t.status === "EN_REVISION",
      href: `/tickets/${t.id}`,
    })),
    ...overdueTasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      type: "tarea" as const,
      inReview: t.status === "EN_REVISION",
      href: `/proyectos/${t.projectId}/tareas/${t.id}`,
    })),
  ].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return <OverdueAlert items={overdueItems} userId={userId} />;
}
