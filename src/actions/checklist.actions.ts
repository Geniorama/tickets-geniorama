"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";

// ─── Tickets ─────────────────────────────────────────────────────────────────

export async function addTicketChecklistItem(ticketId: string, title: string) {
  const session = await getRequiredSession();
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  const count = await prisma.ticketChecklistItem.count({ where: { ticketId } });

  await prisma.ticketChecklistItem.create({
    data: {
      ticketId,
      title: t,
      position: count,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleTicketChecklistItem(itemId: string, ticketId: string) {
  await getRequiredSession();

  const item = await prisma.ticketChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };

  await prisma.ticketChecklistItem.update({
    where: { id: itemId },
    data: { isChecked: !item.isChecked },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicketChecklistItem(itemId: string, ticketId: string) {
  await getRequiredSession();

  await prisma.ticketChecklistItem.delete({ where: { id: itemId } });

  revalidatePath(`/tickets/${ticketId}`);
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function addTaskChecklistItem(taskId: string, projectId: string, title: string) {
  const session = await getRequiredSession();
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  const count = await prisma.taskChecklistItem.count({ where: { taskId } });

  await prisma.taskChecklistItem.create({
    data: {
      taskId,
      title: t,
      position: count,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
}

export async function toggleTaskChecklistItem(itemId: string, taskId: string, projectId: string) {
  await getRequiredSession();

  const item = await prisma.taskChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Ítem no encontrado" };

  await prisma.taskChecklistItem.update({
    where: { id: itemId },
    data: { isChecked: !item.isChecked },
  });

  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
}

export async function deleteTaskChecklistItem(itemId: string, taskId: string, projectId: string) {
  await getRequiredSession();

  await prisma.taskChecklistItem.delete({ where: { id: itemId } });

  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
}
