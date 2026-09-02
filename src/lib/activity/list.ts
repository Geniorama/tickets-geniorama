/**
 * Leer el historial.
 *
 * Dos consultas para dos preguntas: qué le ha pasado a esta ficha, y qué ha
 * pasado hoy en la plataforma. Las dos ordenan por fecha descendente y paginan
 * con cursor —no con `skip`— porque un desplazamiento sobre una tabla que solo
 * crece se vuelve lento justo en las páginas viejas, que son las que se miran
 * cuando alguien está auditando algo de verdad.
 *
 * Quién puede llamarlas es cosa de quien las llama: el historial es de staff, y
 * eso se comprueba en la página, junto al resto del control de acceso.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";
import { entitiesOfModule, type ActivityModule } from "@/lib/activity/catalog";

/** Lo que la interfaz necesita de cada entrada. */
export const activitySelect = {
  id: true,
  entityType: true,
  entityId: true,
  entityLabel: true,
  action: true,
  changes: true,
  meta: true,
  actorId: true,
  actorName: true,
  createdAt: true,
  // El nombre vivo, para que el historial se actualice si alguien se casa y se
  // cambia el apellido. `actorName` es el respaldo de cuando ya no está.
  actor: { select: { id: true, name: true, avatarUrl: true } },
} satisfies Prisma.ActivityLogSelect;

export type ActivityEntry = Prisma.ActivityLogGetPayload<{ select: typeof activitySelect }>;

/** Cuántas entradas trae de una un panel de ficha. */
export const PAGE_SIZE = 30;

/**
 * El historial de una ficha.
 *
 * `before` es el cursor: la fecha de la última entrada ya mostrada.
 */
export function listActivity({
  entityType,
  entityId,
  take = PAGE_SIZE,
  before,
}: {
  entityType: EntityType;
  entityId: string;
  take?: number;
  before?: Date;
}): Promise<ActivityEntry[]> {
  return prisma.activityLog
    .findMany({
      where: {
        entityType,
        entityId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      select: activitySelect,
      orderBy: { createdAt: "desc" },
      take,
    })
    .catch(() => []);
}

export type GlobalFilters = {
  module?: ActivityModule | null;
  action?: string | null;
  actorId?: string | null;
  /** Desde el comienzo de este día, en hora local ya resuelta por quien llama. */
  from?: Date | null;
  to?: Date | null;
  /** Busca en el nombre congelado de la ficha. */
  q?: string | null;
};

function globalWhere(filters: GlobalFilters): Prisma.ActivityLogWhereInput {
  const where: Prisma.ActivityLogWhereInput = {};

  if (filters.module) {
    const entities = entitiesOfModule(filters.module);
    if (entities.length > 0) where.entityType = { in: entities };
  }
  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.q?.trim()) {
    where.entityLabel = { contains: filters.q.trim(), mode: "insensitive" };
  }

  return where;
}

/**
 * El historial de toda la plataforma, filtrado.
 *
 * Devuelve una entrada de más para poder decir si hay página siguiente sin
 * contar la tabla entera, que es una consulta cara y que además cambia entre
 * que se cuenta y se muestra.
 */
export async function listGlobalActivity(
  filters: GlobalFilters,
  /** Id de la última entrada ya mostrada. Prisma resuelve desde ahí. */
  cursorId?: string,
  take = 50,
): Promise<{ entries: ActivityEntry[]; nextCursorId: string | null }> {
  const where = globalWhere(filters);

  const rows = await prisma.activityLog
    .findMany({
      where,
      select: activitySelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      // El id desempata: dos acciones de la misma milésima no pueden hacer que
      // la paginación se salte una o repita otra.
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })
    .catch(() => []);

  const hasMore = rows.length > take;
  const entries = hasMore ? rows.slice(0, take) : rows;
  const last = entries[entries.length - 1];

  return { entries, nextCursorId: hasMore && last ? last.id : null };
}

/**
 * Cuántas entradas tiene cada ficha de una lista.
 *
 * Existe para que un listado pueda mostrar «12 movimientos» sin consultar ficha
 * por ficha, igual que `countCommentsByEntity`.
 */
export async function countActivityByEntity(
  entityType: EntityType,
  entityIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (entityIds.length === 0) return counts;

  const rows = await prisma.activityLog
    .groupBy({
      by: ["entityId"],
      where: { entityType, entityId: { in: entityIds } },
      _count: { _all: true },
    })
    .catch(() => []);

  for (const row of rows) counts.set(row.entityId, row._count._all);
  return counts;
}

/** Quiénes han dejado rastro, para poblar el filtro por persona. */
export async function activityActors(): Promise<{ id: string; name: string }[]> {
  const rows = await prisma.activityLog
    .findMany({
      where: { actorId: { not: null } },
      distinct: ["actorId"],
      select: { actor: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    })
    .catch(() => []);

  const seen = new Map<string, string>();
  for (const row of rows) {
    if (row.actor) seen.set(row.actor.id, row.actor.name);
  }
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}
