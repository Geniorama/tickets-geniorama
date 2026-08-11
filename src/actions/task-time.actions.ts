"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { canInteractWithTask } from "@/lib/task-access";
import type { EntityType } from "@/generated/prisma";
import * as time from "@/lib/time-entries";

/** Contrato de estas acciones: los componentes leen `result?.error`. */
type TimerResult = { error?: string; success?: boolean };

function revalidate(taskId: string, projectId: string | null) {
  revalidatePath(projectId ? `/proyectos/${projectId}/tareas/${taskId}` : `/tareas/${taskId}`);
}

/** Solo el staff con acceso a la tarea puede cronometrar sobre ella. */
async function guard(taskId: string, requireAdmin = false) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return null;
  if (requireAdmin && !isAdmin(session.user.role)) return null;

  const allowed = await canInteractWithTask(taskId, session.user.id, session.user.role);
  if (!allowed) return null;

  return {
    userId: session.user.id,
    entity: { entityType: "TASK" as EntityType, entityId: taskId },
  };
}

export async function startTaskTimer(taskId: string, projectId: string | null): Promise<TimerResult> {
  const ctx = await guard(taskId);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.startTimer(ctx.entity, ctx.userId);
  if (result.error) return result;

  revalidate(taskId, projectId);
  return { success: true };
}

export async function pauseTaskTimer(taskId: string, projectId: string | null): Promise<TimerResult> {
  const ctx = await guard(taskId);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.pauseTimer(ctx.entity);
  if (result.error) return result;

  revalidate(taskId, projectId);
  return { success: true };
}

export async function addManualTaskEntry(
  taskId: string,
  projectId: string | null,
  hours: number,
  minutes: number,
): Promise<TimerResult> {
  const ctx = await guard(taskId, true);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.addManualEntry(ctx.entity, ctx.userId, hours, minutes);
  if (result.error) return result;

  revalidate(taskId, projectId);
  return { success: true };
}

export async function deleteTaskTimeEntry(
  entryId: string,
  taskId: string,
  projectId: string | null,
): Promise<TimerResult> {
  const ctx = await guard(taskId, true);
  if (!ctx) return { error: "Sin permisos" };

  await time.deleteTimeEntry(ctx.entity, entryId);

  revalidate(taskId, projectId);
  return { success: true };
}

export async function resetTaskTimeEntries(taskId: string, projectId: string | null): Promise<TimerResult> {
  const ctx = await guard(taskId, true);
  if (!ctx) return { error: "Sin permisos" };

  await time.resetTimeEntries(ctx.entity);

  revalidate(taskId, projectId);
  return { success: true };
}
