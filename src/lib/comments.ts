/**
 * Núcleo compartido — comentarios.
 *
 * Una sola implementación de comentarios para cualquier entidad del sistema.
 * Agregar comentarios a una app nueva (CRM, finanzas, documentos) es añadir su
 * valor a `EntityType` y llamar a estas funciones: no hay modelos, acciones ni
 * componentes que duplicar.
 *
 * Contrato importante: al no haber clave foránea sobre `entityId`, la base de
 * datos no borra en cascada los comentarios de una entidad eliminada. Todo
 * camino que borre un ticket, tarea o proyecto debe llamar a
 * `deleteCommentsFor()` dentro de la misma transacción.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";

/** Menciones con el formato `@[Nombre](userId)` que produce el editor. */
const MENTION_REGEX = /@\[[^\]]+\]\(([^)]+)\)/g;

export function extractMentionIds(body: string): string[] {
  const ids: string[] = [];
  let match;
  while ((match = MENTION_REGEX.exec(body)) !== null) ids.push(match[1]);
  MENTION_REGEX.lastIndex = 0;
  return [...new Set(ids)];
}

/** Forma que esperan los componentes de UI compartidos. */
export const commentInclude = {
  author: { select: { name: true, role: true } },
  reactions: { select: { type: true, userId: true } },
  attachments: {
    select: { type: true, url: true, name: true },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.CommentInclude;

export type CommentWithRelations = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

export type NewAttachment = {
  type: string;
  url: string;
  name: string | null;
  storagePath: string | null;
};

/**
 * Comentarios de una entidad, en orden cronológico.
 * `includeInternal` en false oculta las notas internas del equipo.
 */
export function listComments({
  entityType,
  entityId,
  includeInternal,
  before,
  take,
}: {
  entityType: EntityType;
  entityId: string;
  includeInternal: boolean;
  before?: Date;
  take?: number;
}): Promise<CommentWithRelations[]> {
  const where: Prisma.CommentWhereInput = {
    entityType,
    entityId,
    ...(includeInternal ? {} : { isInternal: false }),
    ...(before ? { createdAt: { lt: before } } : {}),
  };

  // Sin `take` devolvemos el hilo completo en orden ascendente. Con `take`
  // paginamos hacia atrás desde el cursor, así que hay que invertir el orden.
  if (take === undefined) {
    return prisma.comment.findMany({
      where,
      include: commentInclude,
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.comment
    .findMany({ where, include: commentInclude, take, orderBy: { createdAt: "desc" } })
    .then((rows) => rows.reverse());
}

/**
 * Los N comentarios más recientes de cada entidad de una lista, en orden
 * descendente (el más nuevo primero).
 *
 * Existe para sustituir a los `include: { comments: { take: N } }` que antes
 * colgaban de la relación directa: sin ella habría que consultar entidad por
 * entidad. Resuelve todo en una consulta y agrupa en memoria.
 */
export async function recentCommentsByEntity(
  entityType: EntityType,
  entityIds: string[],
  perEntity: number,
  includeInternal: boolean,
): Promise<Map<string, { body: string; isInternal: boolean; author: { name: string } }[]>> {
  const grouped = new Map<string, { body: string; isInternal: boolean; author: { name: string } }[]>();
  if (entityIds.length === 0) return grouped;

  const rows = await prisma.comment.findMany({
    where: {
      entityType,
      entityId: { in: entityIds },
      ...(includeInternal ? {} : { isInternal: false }),
    },
    select: {
      entityId: true,
      body: true,
      isInternal: true,
      author: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  for (const { entityId, ...comment } of rows) {
    const list = grouped.get(entityId) ?? [];
    if (list.length < perEntity) {
      list.push(comment);
      grouped.set(entityId, list);
    }
  }

  return grouped;
}

/**
 * Cuántos comentarios tiene cada entidad de una lista.
 * Sustituye al `_count: { select: { comments: true } }` de las relaciones
 * directas, que ya no existe al ser polimórfica la tabla.
 */
export async function countCommentsByEntity(
  entityType: EntityType,
  entityIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (entityIds.length === 0) return counts;

  const rows = await prisma.comment.groupBy({
    by: ["entityId"],
    where: { entityType, entityId: { in: entityIds } },
    _count: { _all: true },
  });

  for (const row of rows) counts.set(row.entityId, row._count._all);
  return counts;
}

/**
 * Adjunta el conteo de comentarios a una lista de entidades respetando la forma
 * `_count.comments` que ya consumen los componentes de listado.
 */
export async function withCommentCounts<T extends { id: string }>(
  entityType: EntityType,
  entities: T[],
): Promise<(T & { _count: { comments: number } })[]> {
  const counts = await countCommentsByEntity(
    entityType,
    entities.map((e) => e.id),
  );
  return entities.map((entity) => ({
    ...entity,
    _count: { comments: counts.get(entity.id) ?? 0 },
  }));
}

/**
 * Reemplazo explícito del borrado en cascada que la clave foránea daba antes.
 * Los adjuntos y reacciones sí caen en cascada desde `comments`.
 *
 * Acepta un cliente de transacción para borrar la entidad y sus comentarios de
 * forma atómica.
 */
export function deleteCommentsFor(
  entityType: EntityType,
  entityIds: string | string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return Promise.resolve({ count: 0 });

  return client.comment.deleteMany({
    where: { entityType, entityId: { in: ids } },
  });
}

/** Un comentario con permiso de edición ya verificado, o el motivo del rechazo. */
export async function findEditableComment(
  commentId: string,
  actor: { id: string; role: string },
) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, entityType: true, entityId: true },
  });

  if (!comment) return { error: "Comentario no encontrado" as const };

  const isAdmin = actor.role === "ADMINISTRADOR";
  if (!isAdmin && comment.authorId !== actor.id) {
    return { error: "Sin permisos" as const };
  }

  return { comment };
}
