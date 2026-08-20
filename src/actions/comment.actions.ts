"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { validateFile, uploadFile } from "@/lib/s3";
import { notifyMany } from "@/lib/notify";
import { sendMentionEmail } from "@/lib/email";
import {
  extractMentionIds,
  listComments,
  findEditableComment,
  type NewAttachment,
} from "@/lib/comments";
import { emitCommentHook } from "@/lib/hooks/dispatch";

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

  // Adjuntos múltiples (enlaces y archivos) — solo staff puede adjuntar en tickets
  const attachmentsData: NewAttachment[] = [];

  if (isStaff(session.user.role)) {
    const linksRaw = formData.get("links")?.toString();
    if (linksRaw) {
      try {
        const linksList = JSON.parse(linksRaw) as { url?: string; label?: string }[];
        for (const { url, label } of linksList) {
          const u = (url ?? "").trim();
          if (!u) continue;
          try { new URL(u); } catch { return { error: `Enlace inválido: ${u}` }; }
          attachmentsData.push({ type: "link", url: u, name: label?.trim() || u, storagePath: null });
        }
      } catch { /* JSON inválido, ignorar */ }
    }

    const files = formData.getAll("attachmentFiles").filter((f): f is File => f instanceof File && f.size > 0);
    for (const file of files) {
      const validationError = validateFile(file);
      if (validationError) return { error: `"${file.name}": ${validationError}` };
      try {
        const { storagePath, fileUrl } = await uploadFile(file, ticketId);
        attachmentsData.push({ type: "file", url: fileUrl, name: file.name, storagePath });
      } catch (err) {
        return { error: err instanceof Error ? err.message : "Error al subir archivo" };
      }
    }
  }

  const comment = await prisma.comment.create({
    data: {
      entityType: "TICKET",
      entityId:   ticketId,
      authorId:   session.user.id,
      body:       parsed.data.body,
      isInternal: parsed.data.isInternal,
      ...(attachmentsData.length ? { attachments: { create: attachmentsData } } : {}),
    },
  });

  // Las notas internas las descarta el propio despachador; aquí se avisa igual
  // para no tener dos criterios distintos sobre qué es interno.
  emitCommentHook(comment.id, { actor: session.user });

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

  return listComments({
    entityType: "TICKET",
    entityId: ticketId,
    includeInternal: isStaff(session.user.role),
    before: new Date(cursor),
    take,
  });
}

export async function editComment(commentId: string, ticketId: string, body: string) {
  const session = await getRequiredSession();

  const found = await findEditableComment(commentId, session.user);
  if ("error" in found) return { error: found.error };

  const parsed = z.string().min(1, "El comentario no puede estar vacío").safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.comment.update({ where: { id: commentId }, data: { body: parsed.data } });
  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteComment(commentId: string, ticketId: string) {
  const session = await getRequiredSession();

  const found = await findEditableComment(commentId, session.user);
  if ("error" in found) return { error: found.error };

  await prisma.comment.delete({ where: { id: commentId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
