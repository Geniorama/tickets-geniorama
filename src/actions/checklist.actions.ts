"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession } from "@/lib/auth-helpers";
import { isStaff } from "@/lib/roles";
import { canAccessTicket } from "@/lib/ticket-access";
import { canInteractWithTask } from "@/lib/task-access";
import type { EntityType } from "@/generated/prisma";
import {
  addChecklist,
  addChecklistItems,
  deleteChecklist,
  deleteChecklistItem,
  renameChecklist,
  reorderChecklists,
  toggleChecklistItem,
  updateChecklistItem,
  type ChecklistLayout,
} from "@/lib/checklists";

export type { ChecklistLayout } from "@/lib/checklists";

const SIN_PERMISOS = { error: "Sin permisos" } as const;

function taskPath(taskId: string, projectId: string | null) {
  return projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`;
}

/**
 * Sesión + permiso sobre el ticket. Antes estas acciones solo exigían sesión,
 * así que un `ticketId` adivinado bastaba para tocar el checklist de cualquier
 * ticket, incluido el de otra empresa.
 */
async function ticketGuard(ticketId: string) {
  const session = await getRequiredSession();
  const allowed = await canAccessTicket(ticketId, session.user.id, session.user.role);
  if (!allowed) return null;
  return { userId: session.user.id, entity: { entityType: "TICKET" as EntityType, entityId: ticketId } };
}

/**
 * El checklist de una tarea es de gestión interna. Los clientes con acceso al
 * detalle (mención o revisor) lo ven en solo lectura, así que estas acciones
 * quedan restringidas al staff con acceso a la tarea.
 */
async function taskGuard(taskId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return null;
  const allowed = await canInteractWithTask(taskId, session.user.id, session.user.role);
  if (!allowed) return null;
  return { userId: session.user.id, entity: { entityType: "TASK" as EntityType, entityId: taskId } };
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export async function addTicketChecklist(ticketId: string, title: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  await addChecklist(ctx.entity, title, ctx.userId);
  revalidatePath(`/tickets/${ticketId}`);
}

export async function renameTicketChecklist(checklistId: string, ticketId: string, title: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  const result = await renameChecklist(ctx.entity, checklistId, title);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicketChecklist(checklistId: string, ticketId: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  await deleteChecklist(ctx.entity, checklistId);
  revalidatePath(`/tickets/${ticketId}`);
}

export async function reorderTicketChecklists(ticketId: string, layout: ChecklistLayout[]) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  const result = await reorderChecklists(ctx.entity, layout);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
}

export async function addTicketChecklistItem(ticketId: string, checklistId: string | null, title: string) {
  return addTicketChecklistItems(ticketId, checklistId, [title]);
}

export async function addTicketChecklistItems(
  ticketId: string,
  checklistId: string | null,
  titles: string[],
) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  const result = await addChecklistItems(ctx.entity, checklistId, titles, ctx.userId);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
}

export async function toggleTicketChecklistItem(itemId: string, ticketId: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  const result = await toggleChecklistItem(ctx.entity, itemId);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
}

export async function updateTicketChecklistItem(itemId: string, ticketId: string, title: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  const result = await updateChecklistItem(ctx.entity, itemId, title);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
}

export async function deleteTicketChecklistItem(itemId: string, ticketId: string) {
  const ctx = await ticketGuard(ticketId);
  if (!ctx) return SIN_PERMISOS;

  await deleteChecklistItem(ctx.entity, itemId);
  revalidatePath(`/tickets/${ticketId}`);
}

// ─── Tareas ───────────────────────────────────────────────────────────────────

export async function addTaskChecklist(taskId: string, projectId: string | null, title: string) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  await addChecklist(ctx.entity, title, ctx.userId);
  revalidatePath(taskPath(taskId, projectId));
}

export async function renameTaskChecklist(
  checklistId: string,
  taskId: string,
  projectId: string | null,
  title: string,
) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  const result = await renameChecklist(ctx.entity, checklistId, title);
  if (result.error) return result;

  revalidatePath(taskPath(taskId, projectId));
}

export async function deleteTaskChecklist(checklistId: string, taskId: string, projectId: string | null) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  await deleteChecklist(ctx.entity, checklistId);
  revalidatePath(taskPath(taskId, projectId));
}

export async function reorderTaskChecklists(
  taskId: string,
  projectId: string | null,
  layout: ChecklistLayout[],
) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  const result = await reorderChecklists(ctx.entity, layout);
  if (result.error) return result;

  revalidatePath(taskPath(taskId, projectId));
}

export async function addTaskChecklistItem(
  taskId: string,
  projectId: string | null,
  checklistId: string | null,
  title: string,
) {
  return addTaskChecklistItems(taskId, projectId, checklistId, [title]);
}

export async function addTaskChecklistItems(
  taskId: string,
  projectId: string | null,
  checklistId: string | null,
  titles: string[],
) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  const result = await addChecklistItems(ctx.entity, checklistId, titles, ctx.userId);
  if (result.error) return result;

  revalidatePath(taskPath(taskId, projectId));
}

export async function toggleTaskChecklistItem(itemId: string, taskId: string, projectId: string | null) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  const result = await toggleChecklistItem(ctx.entity, itemId);
  if (result.error) return result;

  revalidatePath(taskPath(taskId, projectId));
}

export async function updateTaskChecklistItem(
  itemId: string,
  taskId: string,
  projectId: string | null,
  title: string,
) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  const result = await updateChecklistItem(ctx.entity, itemId, title);
  if (result.error) return result;

  revalidatePath(taskPath(taskId, projectId));
}

export async function deleteTaskChecklistItem(itemId: string, taskId: string, projectId: string | null) {
  const ctx = await taskGuard(taskId);
  if (!ctx) return SIN_PERMISOS;

  await deleteChecklistItem(ctx.entity, itemId);
  revalidatePath(taskPath(taskId, projectId));
}
