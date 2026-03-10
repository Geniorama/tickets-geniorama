"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";

const addCommentSchema = z.object({
  body: z.string().min(1, "El comentario no puede estar vacío"),
  isInternal: z.boolean().default(false),
});

export async function addComment(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();

  const isInternalRaw = formData.get("isInternal") === "true";
  // Solo staff puede hacer comentarios internos
  const isInternal = isStaff(session.user.role) ? isInternalRaw : false;

  const parsed = addCommentSchema.safeParse({
    body: formData.get("body"),
    isInternal,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId: session.user.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, ticketId: string) {
  const session = await getRequiredSession();

  const comment = await prisma.ticketComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) return { error: "Comentario no encontrado" };

  // Solo el autor o un admin puede eliminar
  const isAdmin = session.user.role === "ADMINISTRADOR";
  if (!isAdmin && comment.authorId !== session.user.id) {
    return { error: "Sin permisos" };
  }

  await prisma.ticketComment.delete({ where: { id: commentId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
