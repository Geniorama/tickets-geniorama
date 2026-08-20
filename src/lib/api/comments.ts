/**
 * Comentarios desde la API pública.
 *
 * Un comentario que entra por aquí nunca es una nota interna: lo escribe una
 * integración en nombre de alguien, y tiene que verlo todo el hilo. Las notas
 * internas siguen siendo cosa de la interfaz, donde se marcan a conciencia.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { notifyMany } from "@/lib/notify";
import { canAccessTicket } from "@/lib/ticket-access";
import { canInteractWithTask } from "@/lib/task-access";
import { emitCommentHook } from "@/lib/hooks/dispatch";
import type { ApiUser } from "@/lib/api/respond";
import type { WriteResult } from "@/lib/api/tickets";

type CommentView = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string | null;
  author: { id: string; name: string; email: string } | null;
};

const select = {
  id: true,
  body: true,
  isInternal: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

function view(row: {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  author: { id: string; name: string; email: string };
}): CommentView {
  return {
    id: row.id,
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt.toISOString(),
    author: row.author,
  };
}

async function canReach(user: ApiUser, entityType: EntityType, entityId: string): Promise<boolean> {
  if (entityType === "TICKET") return canAccessTicket(entityId, user.id, user.role);
  if (entityType === "TASK") return canInteractWithTask(entityId, user.id, user.role);
  return isStaff(user.role);
}

export async function listComments(
  user: ApiUser,
  entityType: EntityType,
  entityId: string,
  opts: { limit: number; cursor: string | null },
): Promise<{ comments: CommentView[]; nextCursor: string | null } | null> {
  if (!(await canReach(user, entityType, entityId))) return null;

  const rows = await prisma.comment.findMany({
    where: {
      entityType,
      entityId,
      // Las notas internas no salen de la plataforma ni para el equipo: la API
      // es un canal externo y no hay forma de saber dónde termina el texto.
      isInternal: false,
    },
    select,
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    comments: page.map(view),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function addCommentViaApi(
  author: ApiUser,
  entityType: EntityType,
  entityId: string,
  body: string,
): Promise<WriteResult<CommentView>> {
  if (!(await canReach(author, entityType, entityId))) {
    return { ok: false, status: 404, error: "No encuentro esa entidad, o no es tuya." };
  }

  const created = await prisma.comment.create({
    data: {
      entityType,
      entityId,
      authorId: author.id,
      isInternal: false,
      body: body.trim(),
    },
    select,
  });

  await notifyParticipants(author, entityType, entityId);
  emitCommentHook(created.id, { actor: { id: author.id, name: author.name } });

  return { ok: true, value: view(created) };
}

/** Los mismos avisos que recibe el hilo cuando alguien comenta desde la web. */
async function notifyParticipants(
  author: ApiUser,
  entityType: EntityType,
  entityId: string,
): Promise<void> {
  if (entityType === "TICKET") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: entityId },
      select: { title: true, createdById: true, assignedToId: true, clientId: true },
    });
    if (!ticket) return;

    const recipients = [ticket.createdById, ticket.assignedToId, ticket.clientId].filter(
      (id): id is string => !!id && id !== author.id,
    );
    await notifyMany(
      recipients,
      "ticket_comment",
      "Nuevo comentario en ticket",
      `${author.name} comentó en: "${ticket.title}"`,
      `/tickets/${entityId}`,
    );
    return;
  }

  if (entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        createdById: true,
        assignedToId: true,
        project: { select: { id: true, isPrivate: true } },
      },
    });
    if (!task) return;

    const link = task.project
      ? `/proyectos/${task.project.id}/tareas/${entityId}`
      : `/tareas/${entityId}`;
    const recipients = [task.createdById, task.assignedToId].filter(
      (id): id is string => !!id && id !== author.id,
    );
    await notifyMany(
      recipients,
      "task_comment",
      "Nuevo comentario en tarea",
      `${author.name} comentó en: "${task.title}"`,
      link,
      task.project?.isPrivate ?? false,
    );
  }
}
