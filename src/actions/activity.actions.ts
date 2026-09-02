"use server";

/**
 * Lo único que el historial expone al cliente: pedir la página siguiente.
 *
 * No hay acciones de escritura. El historial se escribe desde dentro, en el
 * mismo sitio donde ocurre lo que registra, y nadie —tampoco un administrador—
 * lo edita ni lo borra desde la interfaz: una bitácora que se puede retocar no
 * sirve para lo que se le pide.
 */

import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import type { EntityType } from "@/generated/prisma";
import { listActivity, PAGE_SIZE } from "@/lib/activity/list";

export type ActivityPage = {
  entries: {
    id: string;
    entityType: EntityType;
    entityId: string;
    entityLabel: string | null;
    action: string;
    changes: unknown;
    meta: unknown;
    actorName: string | null;
    actor: { id: string; name: string; avatarUrl: string | null } | null;
    createdAt: string;
  }[];
  hasMore: boolean;
};

const EMPTY: ActivityPage = { entries: [], hasMore: false };

/**
 * Las entradas anteriores a `before` de una ficha.
 *
 * El historial es de staff en toda la plataforma, así que la comprobación es
 * una sola y aquí: no hace falta consultar la entidad para saber si quien
 * pregunta puede verla, porque ningún cliente llega a este panel.
 */
export async function getMoreActivity(
  entityType: EntityType,
  entityId: string,
  before: string,
): Promise<ActivityPage> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return EMPTY;

  const cursor = new Date(before);
  if (Number.isNaN(cursor.getTime())) return EMPTY;

  const rows = await listActivity({
    entityType,
    entityId,
    before: cursor,
    take: PAGE_SIZE + 1,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const entries = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map((row) => ({
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    action: row.action,
    changes: row.changes,
    meta: row.meta,
    actorName: row.actorName,
    actor: row.actor,
    createdAt: row.createdAt.toISOString(),
  }));

  return { entries, hasMore };
}
