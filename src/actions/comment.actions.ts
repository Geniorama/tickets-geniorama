"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { validateFile, uploadFile } from "@/lib/s3";
import { notifyMany } from "@/lib/notify";
import { sendMentionEmail } from "@/lib/email";

function extractMentionIds(body: string): string[] {
  const regex = /@\[[^\]]+\]\(([^)]+)\)/g;
  const ids: string[] = [];
  let m;
  while ((m = regex.exec(body)) !== null) ids.push(m[1]);
  return [...new Set(ids)];
}

const addCommentSchema = z.object({
  body: z.string().min(1, "El comentario no puede estar vacío"),
  isInternal: z.boolean().default(false),
});

export async function addComment(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();

  const isInternalRaw = formData.get("isInternal") === "true";
  const isInternal = isStaff(session.user.role) ? isInternalRaw : false;

  const parsed = addCommentSchema.safeParse({
    body: formData.get("body"),
    isInternal,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const attachmentType = formData.get("attachmentType")?.toString() || null;
  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentStoragePath: string | null = null;

  if (attachmentType === "link" && isStaff(session.user.role)) {
    const url = formData.get("linkUrl")?.toString().trim() ?? "";
    const label = formData.get("linkLabel")?.toString().trim() || null;

    if (!url) return { error: "La URL del enlace es requerida" };
    try { new URL(url); } catch { return { error: "La URL no es válida" }; }

    attachmentUrl  = url;
    attachmentName = label ?? url;
  }

  if (attachmentType === "file" && isStaff(session.user.role)) {
    const file = formData.get("attachmentFile");
    if (!(file instanceof File) || file.size === 0) {
      return { error: "No se seleccionó ningún archivo" };
    }
    const validationError = validateFile(file);
    if (validationError) return { error: validationError };

    try {
      const { storagePath, fileUrl } = await uploadFile(file, ticketId);
      attachmentUrl         = fileUrl;
      attachmentName        = file.name;
      attachmentStoragePath = storagePath;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al subir archivo";
      return { error: message };
    }
  }

  await prisma.ticketComment.create({
    data: {
      ticketId,
      authorId:             session.user.id,
      body:                 parsed.data.body,
      isInternal:           parsed.data.isInternal,
      attachmentType,
      attachmentUrl,
      attachmentName,
      attachmentStoragePath,
    },
  });

  // Notificar a usuarios mencionados
  const mentionedIds = extractMentionIds(parsed.data.body).filter(
    (id) => id !== session.user.id
  );
  if (mentionedIds.length > 0) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true },
    });
    await notifyMany(
      mentionedIds,
      "mention",
      `${session.user.name} te mencionó`,
      `En el ticket: "${ticket?.title ?? ""}"`,
      `/tickets/${ticketId}`
    );

    // Enviar email a clientes mencionados
    const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000";
    const mentionedClients = await prisma.user.findMany({
      where: { id: { in: mentionedIds }, role: "CLIENTE", isActive: true },
      select: { name: true, email: true },
    });
    const ticketUrl = `${APP_URL}/tickets/${ticketId}`;
    for (const client of mentionedClients) {
      void sendMentionEmail(
        { name: client.name, email: client.email },
        session.user.name ?? "Alguien",
        "un ticket",
        ticket?.title ?? "",
        ticketUrl
      ).catch(console.error);
    }
  }

  // Notificar a los participantes del ticket (excepto el comentarista)
  if (!parsed.data.isInternal) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true, createdById: true, assignedToId: true, clientId: true },
    });
    if (ticket) {
      const recipients = [ticket.createdById, ticket.assignedToId, ticket.clientId]
        .filter((id): id is string => !!id && id !== session.user.id);
      await notifyMany(
        recipients,
        "ticket_comment",
        "Nuevo comentario en ticket",
        `${session.user.name} comentó en: "${ticket.title}"`,
        `/tickets/${ticketId}`
      );
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function getTicketComments(
  ticketId: string,
  cursor: string,
  take = 50,
) {
  const session = await getRequiredSession();
  const staff = isStaff(session.user.role);

  const comments = await prisma.ticketComment.findMany({
    where: {
      ticketId,
      ...(staff ? {} : { isInternal: false }),
      createdAt: { lt: new Date(cursor) },
    },
    take,
    include: {
      author: { select: { name: true, role: true } },
      reactions: { select: { type: true, userId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return comments.reverse();
}

export async function editComment(commentId: string, ticketId: string, body: string) {
  const session = await getRequiredSession();

  const comment = await prisma.ticketComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) return { error: "Comentario no encontrado" };

  const isAdmin = session.user.role === "ADMINISTRADOR";
  if (!isAdmin && comment.authorId !== session.user.id) return { error: "Sin permisos" };

  const parsed = z.string().min(1, "El comentario no puede estar vacío").safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.ticketComment.update({ where: { id: commentId }, data: { body: parsed.data } });
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

  const isAdmin = session.user.role === "ADMINISTRADOR";
  if (!isAdmin && comment.authorId !== session.user.id) {
    return { error: "Sin permisos" };
  }

  await prisma.ticketComment.delete({ where: { id: commentId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
