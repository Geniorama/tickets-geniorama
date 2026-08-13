import { Suspense } from "react";
import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { OverdueAlertLoader } from "@/components/layout/overdue-alert-loader";
import { TimerProvider } from "@/providers/timer-provider";
import type { ActiveTimer } from "@/providers/timer-provider";
import { findRunningTimerForUser } from "@/lib/time-entries";
import { getAccessibleApps, getGrants } from "@/lib/access/can";

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
  const [unreadCount, runningTimer, me, apps, levels] = await Promise.all([
    prisma.notification.count({
      where: { userId, isRead: false },
    }),
    // Los registros de tiempo son polimórficos: una sola consulta cubre
    // tickets y tareas, y el título de la entidad se resuelve dentro.
    findRunningTimerForUser(userId),
    prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    }),
    getAccessibleApps(session.user),
    getGrants(userId),
  ]);

  const initialTimers: ActiveTimer[] = runningTimer
    ? [
        {
          type: runningTimer.type,
          resourceId: runningTimer.id,
          ...(runningTimer.type === "task" ? { projectId: runningTimer.projectId } : {}),
          title: runningTimer.title,
          startedAt: runningTimer.startedAt.toISOString(),
        },
      ]
    : [];

  return (
    <TimerProvider initialTimers={initialTimers}>
      <DashboardShell
        role={session.user.role}
        apps={apps}
        levels={levels}
        user={session.user}
        avatarUrl={me?.avatarUrl ?? null}
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
