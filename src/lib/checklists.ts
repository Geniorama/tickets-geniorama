/**
 * Núcleo compartido — checklists.
 *
 * Una sola implementación para tickets, tareas y lo que venga. Las acciones de
 * `checklist.actions.ts` quedan como envoltorios finos que resuelven permisos y
 * revalidación; toda la lógica vive aquí.
 *
 * Contrato: el checklist no tiene clave foránea hacia su entidad, así que la
 * base no lo borra cuando se elimina el ticket o la tarea. Usa
 * `deleteChecklistsFor()`. Los ítems sí caen en cascada desde el checklist.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";
import { DEFAULT_CHECKLIST_TITLE, type ChecklistGroup } from "@/lib/checklist";

/**
 * Orden completo del panel: los checklists en su orden y, dentro de cada uno,
 * sus ítems. Con esto una sola acción cubre reordenar checklists, reordenar
 * ítems y mover un ítem de un checklist a otro.
 */
export type ChecklistLayout = { checklistId: string; itemIds: string[] };

type Entity = { entityType: EntityType; entityId: string };

export type ChecklistWithItems = Prisma.ChecklistGetPayload<{
  include: { items: true };
}>;

export function listChecklists({ entityType, entityId }: Entity): Promise<ChecklistWithItems[]> {
  return prisma.checklist.findMany({
    where: { entityType, entityId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
  });
}

/**
 * Cuántos ítems de checklist tiene cada entidad de una lista, en una sola
 * consulta. Sustituye al `_count` anidado sobre la relación directa.
 */
export async function checklistItemCountsByEntity(
  entityType: EntityType,
  entityIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (entityIds.length === 0) return counts;

  const rows = await prisma.checklist.findMany({
    where: { entityType, entityId: { in: entityIds } },
    select: { entityId: true, _count: { select: { items: true } } },
  });

  for (const row of rows) {
    counts.set(row.entityId, (counts.get(row.entityId) ?? 0) + row._count.items);
  }

  return counts;
}

/**
 * Checklist donde debe caer un ítem nuevo: el pedido, si pertenece a la
 * entidad; si no, el primero; y si no hay ninguno, crea uno.
 */
async function resolveChecklist(entity: Entity, checklistId: string | null, userId: string) {
  if (checklistId) {
    const target = await prisma.checklist.findFirst({
      where: { id: checklistId, ...entity },
      select: { id: true },
    });
    if (target) return target.id;
  }

  const first = await prisma.checklist.findFirst({
    where: entity,
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (first) return first.id;

  const created = await prisma.checklist.create({
    data: { ...entity, title: DEFAULT_CHECKLIST_TITLE, position: 0, createdById: userId },
    select: { id: true },
  });
  return created.id;
}

export async function addChecklist(entity: Entity, title: string, userId: string) {
  const t = title.trim() || DEFAULT_CHECKLIST_TITLE;

  const last = await prisma.checklist.findFirst({
    where: entity,
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.checklist.create({
    data: { ...entity, title: t, position: (last?.position ?? -1) + 1, createdById: userId },
  });
}

export async function renameChecklist(entity: Entity, checklistId: string, title: string) {
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.checklist.updateMany({ where: { id: checklistId, ...entity }, data: { title: t } });
  return {};
}

export async function deleteChecklist(entity: Entity, checklistId: string) {
  // Los ítems se van en cascada.
  await prisma.checklist.deleteMany({ where: { id: checklistId, ...entity } });
}

/** Reescribe el orden de los checklists y de sus ítems según el layout recibido. */
export async function reorderChecklists(entity: Entity, layout: ChecklistLayout[]) {
  const checklists = await prisma.checklist.findMany({
    where: entity,
    select: { id: true, items: { select: { id: true } } },
  });
  const validLists = new Set(checklists.map((c) => c.id));
  const validItems = new Set(checklists.flatMap((c) => c.items.map((i) => i.id)));

  const clean = layout
    .filter((l) => validLists.has(l.checklistId))
    .map((l) => ({ checklistId: l.checklistId, itemIds: l.itemIds.filter((id) => validItems.has(id)) }));
  if (clean.length === 0) return { error: "Sin checklists para reordenar" };

  await prisma.$transaction([
    ...clean.map((l, index) =>
      prisma.checklist.update({ where: { id: l.checklistId }, data: { position: index } }),
    ),
    ...clean.flatMap((l) =>
      l.itemIds.map((id, position) =>
        prisma.checklistItem.update({
          where: { id },
          data: { checklistId: l.checklistId, position },
        }),
      ),
    ),
  ]);

  return {};
}

export async function addChecklistItems(
  entity: Entity,
  checklistId: string | null,
  titles: string[],
  userId: string,
) {
  const clean = titles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (clean.length === 0) return { error: "Sin ítems para agregar" };

  const targetId = await resolveChecklist(entity, checklistId, userId);
  const count = await prisma.checklistItem.count({ where: { checklistId: targetId } });

  await prisma.checklistItem.createMany({
    data: clean.map((title, i) => ({
      checklistId: targetId,
      title,
      position: count + i,
      createdById: userId,
    })),
  });

  return {};
}

export async function toggleChecklistItem(entity: Entity, itemId: string) {
  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, checklist: entity },
    select: { id: true, isChecked: true },
  });
  if (!item) return { error: "Ítem no encontrado" };

  await prisma.checklistItem.update({
    where: { id: item.id },
    data: { isChecked: !item.isChecked },
  });

  return {};
}

export async function updateChecklistItem(entity: Entity, itemId: string, title: string) {
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.checklistItem.updateMany({
    where: { id: itemId, checklist: entity },
    data: { title: t },
  });

  return {};
}

export async function deleteChecklistItem(entity: Entity, itemId: string) {
  await prisma.checklistItem.deleteMany({ where: { id: itemId, checklist: entity } });
}

/**
 * Crea los checklists definidos en un formulario o plantilla, en orden.
 * Lo usan la creación de ticket y de tarea.
 */
export async function createChecklistGroups(
  entity: Entity,
  groups: ChecklistGroup[],
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  for (const [index, group] of groups.entries()) {
    await client.checklist.create({
      data: {
        ...entity,
        title: group.title,
        position: index,
        createdById: userId,
        items: {
          create: group.items.map((title, position) => ({
            title,
            position,
            createdById: userId,
          })),
        },
      },
    });
  }
}

/**
 * Reemplazo del borrado en cascada. Los ítems caen solos al irse el checklist.
 */
export function deleteChecklistsFor(
  entityType: EntityType,
  entityIds: string | string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return Promise.resolve({ count: 0 });

  return client.checklist.deleteMany({
    where: { entityType, entityId: { in: ids } },
  });
}
