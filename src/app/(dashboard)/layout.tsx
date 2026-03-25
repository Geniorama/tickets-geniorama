import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/layout/dashboard-shell";

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
  const unreadCount = await prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });

  return (
    <DashboardShell
      role={session.user.role}
      user={session.user}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardShell>
  );
}
