import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OverdueAlert } from "@/components/layout/overdue-alert";
import type { OverdueItem } from "@/components/layout/overdue-alert";
import { fromZonedTime } from "date-fns-tz";

// Evitar que Next.js cachee el layout protegido en el cliente.
// Sin esto, después del logout el router cache puede servir el dashboard
// sin pasar por el middleware de autenticación.
export const dynamic = "force-dynamic";

const TZ = "America/Bogota";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequiredSession();
  const userId = session.user.id;

  const bogotaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: TZ });
  const today = fromZonedTime(`${bogotaDateStr}T00:00:00`, TZ);

  const [unreadCount, overdueTickets, overdueTasks] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    prisma.ticket.findMany({
      where: {
        assignedToId: userId,
        status: { not: "CERRADO" },
        dueDate: { lt: today },
      },
      select: { id: true, title: true, dueDate: true, status: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: { not: "COMPLETADO" },
        dueDate: { lt: today },
      },
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

  return (
    <DashboardShell
      role={session.user.role}
      user={session.user}
      unreadCount={unreadCount}
    >
      <OverdueAlert items={overdueItems} userId={userId} />
      {children}
    </DashboardShell>
  );
}
