"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { isStaff } from "@/lib/roles";
import { DEFAULT_CHECKLIST_TITLE } from "@/lib/checklist";

/**
 * Orden completo del panel: los checklists en su orden y, dentro de cada uno,
 * sus ítems. Con esto una sola acción cubre reordenar checklists, reordenar
 * ítems y mover un ítem de un checklist a otro.
 */
export type ChecklistLayout = { checklistId: string; itemIds: string[] };

function taskPath(taskId: string, projectId: string | null) {
  return projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

/**
 * Devuelve el checklist donde debe caer un ítem nuevo: el pedido, si pertenece
 * al ticket; si no, el primero; y si el ticket no tiene ninguno, crea uno.
 */
async function resolveTicketChecklist(ticketId: string, checklistId: string | null, userId: string) {
  if (checklistId) {
    const target = await prisma.ticketChecklist.findFirst({
      where: { id: checklistId, ticketId },
      select: { id: true },
    });
    if (target) return target.id;
  }

  const first = await prisma.ticketChecklist.findFirst({
    where: { ticketId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (first) return first.id;

  const created = await prisma.ticketChecklist.create({
    data: { ticketId, title: DEFAULT_CHECKLIST_TITLE, position: 0, createdById: userId },
    select: { id: true },
  });
  return created.id;
}

export async function addTicketChecklist(ticketId: string, title: string) {
  const session = await getRequiredSession();
  const t = title.trim() || DEFAULT_CHECKLIST_TITLE;

  const last = await prisma.ticketChecklist.findFirst({
    where: { ticketId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.ticketChecklist.create({
    data: {
      ticketId,
      title: t,
      position: (last?.position ?? -1) + 1,
      createdById: session.user.id,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function renameTicketChecklist(checklistId: string, ticketId: string, title: string) {
  await getRequiredSession();
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.ticketChecklist.updateMany({
    where: { id: checklistId, ticketId },
    data: { title: t },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicketChecklist(checklistId: string, ticketId: string) {
  await getRequiredSession();

  // Los ítems se van en cascada.
  await prisma.ticketChecklist.deleteMany({ where: { id: checklistId, ticketId } });

  revalidatePath(`/tickets/${ticketId}`);
}

/** Reescribe el orden de los checklists y de sus ítems según el layout recibido. */
export async function reorderTicketChecklists(ticketId: string, layout: ChecklistLayout[]) {
  await getRequiredSession();

  const checklists = await prisma.ticketChecklist.findMany({
    where: { ticketId },
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
      prisma.ticketChecklist.update({ where: { id: l.checklistId }, data: { position: index } })
    ),
    ...clean.flatMap((l) =>
      l.itemIds.map((id, position) =>
        prisma.ticketChecklistItem.update({
          where: { id },
          data: { checklistId: l.checklistId, position },
        })
      )
    ),
  ]);

  revalidatePath(`/tickets/${ticketId}`);
}

export async function addTicketChecklistItem(ticketId: string, checklistId: string | null, title: string) {
  const session = await getRequiredSession();
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  const targetId = await resolveTicketChecklist(ticketId, checklistId, session.user.id);
  const count = await prisma.ticketChecklistItem.count({ where: { checklistId: targetId } });

  await prisma.ticketChecklistItem.create({
    data: { checklistId: targetId, title: t, position: count, createdById: session.user.id },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function addTicketChecklistItems(ticketId: string, checklistId: string | null, titles: string[]) {
  const session = await getRequiredSession();
  const clean = titles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (clean.length === 0) return { error: "Sin ítems para agregar" };

  const targetId = await resolveTicketChecklist(ticketId, checklistId, session.user.id);
  const count = await prisma.ticketChecklistItem.count({ where: { checklistId: targetId } });

  await prisma.ticketChecklistItem.createMany({
    data: clean.map((title, i) => ({
      checklistId: targetId,
      title,
      position: count + i,
      createdById: session.user.id,
    })),
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleTicketChecklistItem(itemId: string, ticketId: string) {
  await getRequiredSession();

  const item = await prisma.ticketChecklistItem.findFirst({
    where: { id: itemId, checklist: { ticketId } },
    select: { id: true, isChecked: true },
  });
  if (!item) return { error: "Ítem no encontrado" };

  await prisma.ticketChecklistItem.update({
    where: { id: item.id },
    data: { isChecked: !item.isChecked },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateTicketChecklistItem(itemId: string, ticketId: string, title: string) {
  await getRequiredSession();
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.ticketChecklistItem.updateMany({
    where: { id: itemId, checklist: { ticketId } },
    data: { title: t },
  });

  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicketChecklistItem(itemId: string, ticketId: string) {
  await getRequiredSession();

  await prisma.ticketChecklistItem.deleteMany({ where: { id: itemId, checklist: { ticketId } } });

  revalidatePath(`/tickets/${ticketId}`);
}

// ─── Tareas ───────────────────────────────────────────────────────────────────

// El checklist de una tarea es de gestión interna. Los clientes con acceso al
// detalle (mención o revisor) lo ven en solo lectura, así que estas acciones
// quedan restringidas al staff.

async function resolveTaskChecklist(taskId: string, checklistId: string | null, userId: string) {
  if (checklistId) {
    const target = await prisma.taskChecklist.findFirst({
      where: { id: checklistId, taskId },
      select: { id: true },
    });
    if (target) return target.id;
  }

  const first = await prisma.taskChecklist.findFirst({
    where: { taskId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  if (first) return first.id;

  const created = await prisma.taskChecklist.create({
    data: { taskId, title: DEFAULT_CHECKLIST_TITLE, position: 0, createdById: userId },
    select: { id: true },
  });
  return created.id;
}

export async function addTaskChecklist(taskId: string, projectId: string | null, title: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const t = title.trim() || DEFAULT_CHECKLIST_TITLE;

  const last = await prisma.taskChecklist.findFirst({
    where: { taskId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.taskChecklist.create({
    data: {
      taskId,
      title: t,
      position: (last?.position ?? -1) + 1,
      createdById: session.user.id,
    },
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function renameTaskChecklist(
  checklistId: string,
  taskId: string,
  projectId: string | null,
  title: string,
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.taskChecklist.updateMany({
    where: { id: checklistId, taskId },
    data: { title: t },
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function deleteTaskChecklist(checklistId: string, taskId: string, projectId: string | null) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.taskChecklist.deleteMany({ where: { id: checklistId, taskId } });

  revalidatePath(taskPath(taskId, projectId));
}

/** Reescribe el orden de los checklists y de sus ítems según el layout recibido. */
export async function reorderTaskChecklists(
  taskId: string,
  projectId: string | null,
  layout: ChecklistLayout[],
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const checklists = await prisma.taskChecklist.findMany({
    where: { taskId },
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
      prisma.taskChecklist.update({ where: { id: l.checklistId }, data: { position: index } })
    ),
    ...clean.flatMap((l) =>
      l.itemIds.map((id, position) =>
        prisma.taskChecklistItem.update({
          where: { id },
          data: { checklistId: l.checklistId, position },
        })
      )
    ),
  ]);

  revalidatePath(taskPath(taskId, projectId));
}

export async function addTaskChecklistItem(
  taskId: string,
  projectId: string | null,
  checklistId: string | null,
  title: string,
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  const targetId = await resolveTaskChecklist(taskId, checklistId, session.user.id);
  const count = await prisma.taskChecklistItem.count({ where: { checklistId: targetId } });

  await prisma.taskChecklistItem.create({
    data: { checklistId: targetId, title: t, position: count, createdById: session.user.id },
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function addTaskChecklistItems(
  taskId: string,
  projectId: string | null,
  checklistId: string | null,
  titles: string[],
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const clean = titles.map((t) => t.trim()).filter((t) => t.length > 0);
  if (clean.length === 0) return { error: "Sin ítems para agregar" };

  const targetId = await resolveTaskChecklist(taskId, checklistId, session.user.id);
  const count = await prisma.taskChecklistItem.count({ where: { checklistId: targetId } });

  await prisma.taskChecklistItem.createMany({
    data: clean.map((title, i) => ({
      checklistId: targetId,
      title,
      position: count + i,
      createdById: session.user.id,
    })),
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function toggleTaskChecklistItem(itemId: string, taskId: string, projectId: string | null) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const item = await prisma.taskChecklistItem.findFirst({
    where: { id: itemId, checklist: { taskId } },
    select: { id: true, isChecked: true },
  });
  if (!item) return { error: "Ítem no encontrado" };

  await prisma.taskChecklistItem.update({
    where: { id: item.id },
    data: { isChecked: !item.isChecked },
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function updateTaskChecklistItem(
  itemId: string,
  taskId: string,
  projectId: string | null,
  title: string,
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const t = title.trim();
  if (!t) return { error: "El título no puede estar vacío" };

  await prisma.taskChecklistItem.updateMany({
    where: { id: itemId, checklist: { taskId } },
    data: { title: t },
  });

  revalidatePath(taskPath(taskId, projectId));
}

export async function deleteTaskChecklistItem(itemId: string, taskId: string, projectId: string | null) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  await prisma.taskChecklistItem.deleteMany({ where: { id: itemId, checklist: { taskId } } });

  revalidatePath(taskPath(taskId, projectId));
}
