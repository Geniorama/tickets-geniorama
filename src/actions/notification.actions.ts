"use server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: Date;
};

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  link: true,
  isRead: true,
  createdAt: true,
} as const;

/** Tope de no leídas que se listan; el contador sigue siendo el real. */
const MAX_UNREAD_LISTED = 100;
/** Leídas recientes que acompañan a las no leídas. */
const RECENT_READ_LISTED = 30;

/**
 * Lo que muestra la campana: todas las no leídas primero (hasta el tope) y
 * después las leídas recientes, más el contador real de no leídas.
 *
 * Antes se traían solo las 30 más recientes y el contador se recalculaba con
 * ellas: una no leída más antigua que esas 30 contaba en el número de la
 * campana pero no salía en la lista, y al abrirla el número bajaba solo.
 */
export async function getNotifications(): Promise<{ items: NotificationItem[]; unreadCount: number }> {
  const session = await getRequiredSession();
  const userId = session.user.id;

  const [unread, recentRead, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
      take: MAX_UNREAD_LISTED,
      select: notificationSelect,
    }),
    prisma.notification.findMany({
      where: { userId, isRead: true },
      orderBy: { createdAt: "desc" },
      take: RECENT_READ_LISTED,
      select: notificationSelect,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { items: [...unread, ...recentRead], unreadCount };
}

export async function getUnreadCount(): Promise<number> {
  const session = await getRequiredSession();
  return prisma.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

export async function markAsRead(notificationId: string): Promise<void> {
  const session = await getRequiredSession();
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(): Promise<void> {
  const session = await getRequiredSession();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}
