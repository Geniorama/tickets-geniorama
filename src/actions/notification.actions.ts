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

export async function getNotifications(): Promise<NotificationItem[]> {
  const session = await getRequiredSession();
  return prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      link: true,
      isRead: true,
      createdAt: true,
    },
  });
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
