/**
 * Lo que cuelga de la ficha de un ticket o una tarea: checklists, adjuntos,
 * bóveda vinculada, tiempo e historial.
 *
 * Son las pestañas de la ficha vistas desde fuera. La regla es que por aquí no
 * se ve nada que la misma persona no vea en la plataforma:
 *
 * - La puerta es la de siempre (`getTicket` / `getTask`). En tareas, un cliente
 *   además tiene que haber sido involucrado —revisor o mencionado—, porque el
 *   detalle de una tarea es interno aunque el listado no lo sea.
 * - La bóveda solo enseña las entradas que quien pregunta creó o le
 *   compartieron, y de ellas el título, el usuario y la URL. La contraseña y
 *   las notas no salen por ningún canal externo: quien las necesite las abre
 *   en la plataforma.
 * - El tiempo es del equipo; un cliente lo ve solo en un ticket ya cerrado.
 * - El historial es de staff, como en toda la plataforma.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { canClientAccessTask } from "@/lib/task-access";
import { addLinkAttachments, listAttachments } from "@/lib/attachments";
import {
  addChecklist,
  addChecklistItems,
  listChecklists,
  setChecklistItemChecked,
  updateChecklistItem,
} from "@/lib/checklists";
import { listTimeEntries, totalElapsedMs } from "@/lib/time-entries";
import { linkedTo, vaultAccessFilter } from "@/lib/vault-links";
import { listActivity } from "@/lib/activity/list";
import { getTask } from "@/lib/api/tasks";
import { getTicket, type WriteResult } from "@/lib/api/tickets";
import type { ApiUser } from "@/lib/api/respond";

export type PanelEntity = "TICKET" | "TASK";

type Entity = { entityType: EntityType; entityId: string };

type Reach = {
  entity: Entity;
  staff: boolean;
  timeVisible: boolean;
  /** De dónde salen las entradas de bóveda; null si esta persona no las ve aquí. */
  vaultEntity: Entity | null;
};

const NOT_FOUND = { ok: false, status: 404, error: "No encuentro esa tarea o ticket, o no tienes acceso" } as const;

/** ¿Puede esta persona abrir la ficha? Y si puede, qué pestañas le tocan. */
async function reach(user: ApiUser, entityType: PanelEntity, entityId: string): Promise<Reach | null> {
  const staff = isStaff(user.role);
  const entity: Entity = { entityType, entityId };

  if (entityType === "TICKET") {
    const ticket = await getTicket(user, entityId);
    if (!ticket) return null;
    return { entity, staff, timeVisible: staff || ticket.status === "CERRADO", vaultEntity: entity };
  }

  if (!(await getTask(user, entityId))) return null;
  if (!staff && !(await canClientAccessTask(entityId, user.id))) return null;

  // En tareas la bóveda es la del proyecto, y es configuración interna
  let vaultEntity: Entity | null = null;
  if (staff) {
    const task = await prisma.task.findUnique({ where: { id: entityId }, select: { projectId: true } });
    if (task?.projectId) vaultEntity = { entityType: "PROJECT", entityId: task.projectId };
  }
  return { entity, staff, timeVisible: staff, vaultEntity };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

async function readChecklists(entity: Entity) {
  const checklists = await listChecklists(entity);
  return checklists.map((c) => ({
    id: c.id,
    title: c.title,
    items: c.items.map((i) => ({ id: i.id, title: i.title, checked: i.isChecked })),
  }));
}

async function readAttachments({ entityType, entityId }: Entity) {
  const attachments = await listAttachments(entityType, entityId);
  return attachments.map((a) => ({
    id: a.id,
    type: a.type,
    name: a.fileName,
    url: a.fileUrl,
    uploadedBy: a.uploadedBy.name,
    createdAt: a.createdAt.toISOString(),
  }));
}

async function readTime(entity: Entity) {
  const entries = await listTimeEntries(entity);
  return {
    totalMinutes: Math.round(totalElapsedMs(entries) / 60_000),
    running: entries.some((e) => !e.stoppedAt),
    entries: entries.map((e) => ({
      user: e.user.name,
      startedAt: e.startedAt.toISOString(),
      stoppedAt: e.stoppedAt?.toISOString() ?? null,
    })),
  };
}

export type Panels = {
  checklists: Awaited<ReturnType<typeof readChecklists>>;
  attachments: Awaited<ReturnType<typeof readAttachments>>;
  vaultEntries: { id: string; title: string; username: string | null; url: string | null }[];
  time?: Awaited<ReturnType<typeof readTime>>;
};

/** Las pestañas de la ficha. Null si quien pregunta no puede abrirla. */
export async function getPanels(user: ApiUser, entityType: PanelEntity, entityId: string): Promise<Panels | null> {
  const r = await reach(user, entityType, entityId);
  if (!r) return null;

  const [checklists, attachments, vaultEntries, time] = await Promise.all([
    readChecklists(r.entity),
    readAttachments(r.entity),
    r.vaultEntity
      ? prisma.vaultEntry.findMany({
          where: { ...linkedTo(r.vaultEntity), ...vaultAccessFilter(user.id) },
          select: { id: true, title: true, username: true, url: true },
          orderBy: { title: "asc" },
        })
      : Promise.resolve([]),
    r.timeVisible ? readTime(r.entity) : Promise.resolve(undefined),
  ]);

  return { checklists, attachments, vaultEntries, ...(time ? { time } : {}) };
}

export async function listActivityViaApi(
  user: ApiUser,
  entityType: PanelEntity,
  entityId: string,
  opts: { limit: number; cursor: string | null },
) {
  const r = await reach(user, entityType, entityId);
  if (!r || !r.staff) return null;

  const before = opts.cursor ? new Date(opts.cursor) : undefined;
  const rows = await listActivity({
    entityType,
    entityId,
    take: opts.limit + 1,
    ...(before && !Number.isNaN(before.getTime()) ? { before } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    activity: page.map((row) => ({
      id: row.id,
      action: row.action,
      changes: row.changes,
      meta: row.meta,
      actor: row.actor?.name ?? row.actorName,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
  };
}

// ─── Escritura ───────────────────────────────────────────────────────────────

/**
 * Mismo reparto que en la plataforma: el checklist de un ticket lo toca quien
 * tiene acceso al ticket; el de una tarea es gestión interna y es del equipo.
 */
async function reachForChecklist(user: ApiUser, entityType: PanelEntity, entityId: string) {
  const r = await reach(user, entityType, entityId);
  if (!r) return NOT_FOUND;
  if (entityType === "TASK" && !r.staff) {
    return { ok: false, status: 403, error: "Solo el equipo puede modificar el checklist de una tarea." } as const;
  }
  return { ok: true, entity: r.entity } as const;
}

export async function addChecklistItemsViaApi(
  user: ApiUser,
  entityType: PanelEntity,
  entityId: string,
  input: { checklistId?: string; newChecklistTitle?: string; items: string[] },
): Promise<WriteResult<Panels["checklists"]>> {
  const guard = await reachForChecklist(user, entityType, entityId);
  if (!guard.ok) return guard;
  const { entity } = guard;

  let checklistId = input.checklistId ?? null;
  if (checklistId) {
    // Sin esta comprobación, un id equivocado dejaría caer los ítems en el
    // primer checklist de la ficha sin avisar
    const exists = await prisma.checklist.findFirst({ where: { id: checklistId, ...entity }, select: { id: true } });
    if (!exists) return { ok: false, status: 404, error: "Ese checklist no es de esta ficha." };
  } else if (input.newChecklistTitle?.trim()) {
    checklistId = (await addChecklist(entity, input.newChecklistTitle, user.id)).id;
  }

  if (input.items.length > 0) {
    const result = await addChecklistItems(entity, checklistId, input.items, user.id);
    if (result.error) return { ok: false, status: 422, error: result.error };
  } else if (!input.newChecklistTitle?.trim()) {
    return { ok: false, status: 422, error: "Sin ítems para agregar" };
  }

  return { ok: true, value: await readChecklists(entity) };
}

export async function updateChecklistItemViaApi(
  user: ApiUser,
  entityType: PanelEntity,
  entityId: string,
  itemId: string,
  input: { checked?: boolean; title?: string },
): Promise<WriteResult<Panels["checklists"]>> {
  const guard = await reachForChecklist(user, entityType, entityId);
  if (!guard.ok) return guard;
  const { entity } = guard;

  if (input.checked === undefined && input.title === undefined) {
    return { ok: false, status: 422, error: "Indica checked, title o ambos." };
  }

  const item = await prisma.checklistItem.findFirst({
    where: { id: itemId, checklist: entity },
    select: { id: true },
  });
  if (!item) return { ok: false, status: 404, error: "Ítem no encontrado en esta ficha." };

  if (input.title !== undefined) {
    const result = await updateChecklistItem(entity, itemId, input.title);
    if (result.error) return { ok: false, status: 422, error: result.error };
  }
  if (input.checked !== undefined) {
    await setChecklistItemChecked(entity, itemId, input.checked);
  }

  return { ok: true, value: await readChecklists(entity) };
}

/**
 * Solo enlaces: un archivo necesita subirse a R2 y eso no cabe en una llamada
 * de herramienta. Y solo el equipo, igual que en la ficha.
 */
export async function addLinkAttachmentViaApi(
  user: ApiUser,
  entityType: PanelEntity,
  entityId: string,
  input: { url: string; label?: string },
): Promise<WriteResult<Panels["attachments"]>> {
  const r = await reach(user, entityType, entityId);
  if (!r) return NOT_FOUND;
  if (!r.staff) return { ok: false, status: 403, error: "Solo el equipo puede adjuntar a la ficha." };

  if (!/^https?:\/\//i.test(input.url.trim())) {
    return { ok: false, status: 422, error: "El enlace debe empezar por http:// o https://" };
  }

  const { error } = await addLinkAttachments({
    entityType,
    entityId,
    links: [{ url: input.url, label: input.label }],
    uploadedById: user.id,
  });
  if (error) return { ok: false, status: 422, error };

  return { ok: true, value: await readAttachments(r.entity) };
}
