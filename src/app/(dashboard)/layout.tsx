import { Suspense } from "react";
import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OverdueAlertLoader } from "@/components/layout/overdue-alert-loader";
import { TimerProvider } from "@/providers/timer-provider";
import type { ActiveTimer } from "@/providers/timer-provider";

// Evitar que Next.js cachee el layout protegido en el cliente.
// Sin esto, después del logout el router cache puede servir el dashboard
// sin pasar por el middleware de autenticación.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getRequiredSession();
  const userId = session.user.id;

  // Queries ligeras: count + findFirst — no bloquean significativamente
  const [unreadCount, activeTicketEntry, activeTaskEntry] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    prisma.timeEntry.findFirst({
      where: { userId, stoppedAt: null },
      select: {
        startedAt: true,
        ticket: { select: { id: true, title: true } },
      },
    }),
    prisma.taskTimeEntry.findFirst({
      where: { userId, stoppedAt: null },
      select: {
        startedAt: true,
        task: { select: { id: true, title: true, projectId: true } },
      },
    }),
  ]);

  const initialTimers: ActiveTimer[] = [
    ...(activeTicketEntry
      ? [
          {
            type: "ticket" as const,
            resourceId: activeTicketEntry.ticket.id,
            title: activeTicketEntry.ticket.title,
            startedAt: activeTicketEntry.startedAt.toISOString(),
          },
        ]
      : []),
    ...(activeTaskEntry
      ? [
          {
            type: "task" as const,
            resourceId: activeTaskEntry.task.id,
            projectId: activeTaskEntry.task.projectId,
            title: activeTaskEntry.task.title,
            startedAt: activeTaskEntry.startedAt.toISOString(),
          },
        ]
      : []),
  ];

  return (
    <TimerProvider initialTimers={initialTimers}>
      <DashboardShell
        role={session.user.role}
        user={session.user}
        unreadCount={unreadCount}
      >
        <Suspense fallback={null}>
          <OverdueAlertLoader userId={userId} />
        </Suspense>
        {children}
      </DashboardShell>
    </TimerProvider>
  );
}
