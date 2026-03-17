"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
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
  projectId: string,
  type: ReactionType
) {
  const session = await getRequiredSession();
  const userId = session.user.id;

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

  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
}
