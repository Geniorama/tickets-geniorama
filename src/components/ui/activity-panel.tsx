/**
 * El historial de una ficha, listo para colgar en cualquier página.
 *
 * Es un componente de servidor: consulta él mismo y decide él mismo si le toca
 * aparecer. Que la comprobación de acceso viva aquí y no en cada página es
 * deliberado —el historial es de staff, y basta con que una de las diez fichas
 * olvide el `staff &&` para que un cliente vea la trastienda.
 */

import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import type { EntityType } from "@/generated/prisma";
import { listActivity, PAGE_SIZE } from "@/lib/activity/list";
import { ActivityTimeline } from "@/components/ui/activity-timeline";

export async function ActivityPanel({
  entityType,
  entityId,
  title,
  emptyLabel,
}: {
  entityType: EntityType;
  entityId: string;
  title?: string;
  emptyLabel?: string;
}) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return null;

  // Una de más para saber si hay página siguiente sin contar la tabla.
  const rows = await listActivity({ entityType, entityId, take: PAGE_SIZE + 1 });
  const hasMore = rows.length > PAGE_SIZE;

  const initial = (hasMore ? rows.slice(0, PAGE_SIZE) : rows).map((row) => ({
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

  return (
    <ActivityTimeline
      entityType={entityType}
      entityId={entityId}
      initial={initial}
      hasMore={hasMore}
      title={title}
      emptyLabel={emptyLabel}
    />
  );
}
