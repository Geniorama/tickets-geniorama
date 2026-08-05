"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { canInteractWithTask } from "@/lib/task-access";
import type { ReactionType } from "@/generated/prisma";

export async function toggleTicketCommentReaction(
  commentId: string,
  ticketId: string,
  type: ReactionType
) {
  const session = await getRequiredSession();
  const userId = session.user.id;

  const existing = await prisma.ticketCommentReaction.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing?.type === type) {
    await prisma.ticketCommentReaction.delete({
      where: { commentId_userId: { commentId, userId } },
    });
  } else {
    await prisma.ticketCommentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, type },
      update: { type },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleTaskCommentReaction(
  commentId: string,
  taskId: string,
  projectId: string | null,
  type: ReactionType
) {
  const session = await getRequiredSession();
  const userId = session.user.id;

  // El staff siempre puede; el cliente solo en tareas donde lo involucraron
  const allowed = await canInteractWithTask(taskId, userId, session.user.role);
  if (!allowed) return;

  const existing = await prisma.taskCommentReaction.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing?.type === type) {
    await prisma.taskCommentReaction.delete({
      where: { commentId_userId: { commentId, userId } },
    });
  } else {
    await prisma.taskCommentReaction.upsert({
      where: { commentId_userId: { commentId, userId } },
      create: { commentId, userId, type },
      update: { type },
    });
  }

  revalidatePath(projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`);
}
