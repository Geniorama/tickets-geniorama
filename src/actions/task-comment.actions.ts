"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { validateFile, uploadCommentFile } from "@/lib/s3";
import { notifyMany } from "@/lib/notify";
import { sendMentionEmail } from "@/lib/email";
import { canInteractWithTask } from "@/lib/task-access";
import {
  extractMentionIds,
  listComments,
  findEditableComment,
  type NewAttachment,
} from "@/lib/comments";

const commentSchema = z.object({
  body: z.string().min(1, "El comentario no puede estar vacío"),
});

export async function addTaskComment(
  taskId: string,
  projectId: string | null,
  formData: FormData
) {
  const session = await getRequiredSession();

  // El staff siempre puede; el cliente solo en tareas donde lo involucraron
  const allowed = await canInteractWithTask(taskId, session.user.id, session.user.role);
  if (!allowed) return { error: "Sin permisos" };

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Adjuntos múltiples (enlaces y archivos)
  const attachmentsData: NewAttachment[] = [];

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
      const { storagePath, fileUrl } = await uploadCommentFile(file, "TASK", taskId);
      attachmentsData.push({ type: "file", url: fileUrl, name: file.name, storagePath });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error al subir archivo" };
    }
  }

  await prisma.comment.create({
    data: {
      entityType: "TASK",
      entityId:   taskId,
      authorId:   session.user.id,
      body:       parsed.data.body,
      ...(attachmentsData.length ? { attachments: { create: attachmentsData } } : {}),
    },
  });

  // Obtener tarea con info del proyecto para determinar privacidad
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      title: true,
      createdById: true,
      assignedToId: true,
      project: { select: { isPrivate: true } },
    },
  });

  const projectIsPrivate = task?.project?.isPrivate ?? false;
  const taskPath = projectId
    ? `/proyectos/${projectId}/tareas/${taskId}`
    : `/tareas/${taskId}`;

  // Notificar a usuarios mencionados
  const mentionedIds = extractMentionIds(parsed.data.body).filter(
    (id) => id !== session.user.id
  );
  if (mentionedIds.length > 0) {
    await notifyMany(
      mentionedIds,
      "mention",
      `${session.user.name} te mencionó`,
      `En la tarea: "${task?.title ?? ""}"`,
      taskPath,
      projectIsPrivate
    );

    // Enviar email a clientes mencionados
    const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000";
    const mentionedClients = await prisma.user.findMany({
      where: { id: { in: mentionedIds }, role: "CLIENTE", isActive: true },
      select: { name: true, email: true },
    });
    const taskUrl = `${APP_URL}${taskPath}`;
    for (const client of mentionedClients) {
      void sendMentionEmail(
        { name: client.name, email: client.email },
        session.user.name ?? "Alguien",
        "una tarea",
        task?.title ?? "",
        taskUrl
      ).catch(console.error);
    }
  }

  // Notificar al creador y asignado de la tarea (excepto el comentarista)
  if (task) {
    const recipients = [task.createdById, task.assignedToId]
      .filter((id): id is string => !!id && id !== session.user.id);
    await notifyMany(
      recipients,
      "task_comment",
      "Nuevo comentario en tarea",
      `${session.user.name} comentó en: "${task.title}"`,
      taskPath,
      projectIsPrivate
    );
  }

  revalidatePath(taskPath);
  return { success: true };
}

export async function getTaskComments(
  taskId: string,
  cursor: string,
  take = 50,
) {
  const session = await getRequiredSession();

  const allowed = await canInteractWithTask(taskId, session.user.id, session.user.role);
  if (!allowed) return [];

  return listComments({
    entityType: "TASK",
    entityId: taskId,
    includeInternal: true, // las tareas no distinguen notas internas
    before: new Date(cursor),
    take,
  });
}

export async function editTaskComment(
  commentId: string,
  taskId: string,
  projectId: string | null,
  body: string
) {
  const session = await getRequiredSession();

  const found = await findEditableComment(commentId, session.user);
  if ("error" in found) return { error: found.error };

  const parsed = z.string().min(1, "El comentario no puede estar vacío").safeParse(body);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.comment.update({ where: { id: commentId }, data: { body: parsed.data } });
  revalidatePath(projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`);
  return { success: true };
}

export async function deleteTaskComment(
  commentId: string,
  taskId: string,
  projectId: string | null
) {
  const session = await getRequiredSession();

  const found = await findEditableComment(commentId, session.user);
  if ("error" in found) return { error: found.error };

  await prisma.comment.delete({ where: { id: commentId } });
  revalidatePath(projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`);
  return { success: true };
}
