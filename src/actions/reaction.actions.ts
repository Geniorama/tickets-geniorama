"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { canInteractWithTask } from "@/lib/task-access";
import type { ReactionType } from "@/generated/prisma";

/**
 * Alterna la reacción del usuario sobre un comentario, sin importar a qué
 * entidad pertenezca. Volver a pulsar la misma reacción la quita.
 */
async function toggleReaction(commentId: string, userId: string, type: ReactionType) {
  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId: { commentId, userId } },
  });

  if (existing?.type === type) {
    await prisma.commentReaction.delete({
      where: { commentId_userId: { commentId, userId } },
    });
    return;
  }

  await prisma.commentReaction.upsert({
    where: { commentId_userId: { commentId, userId } },
    create: { commentId, userId, type },
    update: { type },
  });
}

export async function toggleTicketCommentReaction(
  commentId: string,
  ticketId: string,
  type: ReactionType
) {
  const session = await getRequiredSession();

  await toggleReaction(commentId, session.user.id, type);

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleTaskCommentReaction(
  commentId: string,
  taskId: string,
  projectId: string | null,
  type: ReactionType
) {
  const session = await getRequiredSession();

  // El staff siempre puede; el cliente solo en tareas donde lo involucraron
  const allowed = await canInteractWithTask(taskId, session.user.id, session.user.role);
  if (!allowed) return;

  await toggleReaction(commentId, session.user.id, type);

  revalidatePath(projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`);
}
