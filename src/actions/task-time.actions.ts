"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";

function revalidate(taskId: string, projectId: string) {
  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
}

export async function startTaskTimer(taskId: string, projectId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const active = await prisma.taskTimeEntry.findFirst({
    where: { taskId, stoppedAt: null },
  });
  if (active) return { error: "Ya hay un contador activo para esta tarea" };

  await prisma.taskTimeEntry.create({
    data: { taskId, userId: session.user.id, startedAt: new Date() },
  });

  revalidate(taskId, projectId);
  return { success: true };
}

export async function pauseTaskTimer(taskId: string, projectId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const active = await prisma.taskTimeEntry.findFirst({
    where: { taskId, stoppedAt: null },
  });
  if (!active) return { error: "No hay un contador activo" };

  await prisma.taskTimeEntry.update({
    where: { id: active.id },
    data: { stoppedAt: new Date() },
  });

  revalidate(taskId, projectId);
  return { success: true };
}

export async function addManualTaskEntry(
  taskId: string,
  projectId: string,
  hours: number,
  minutes: number,
) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  const totalMs = (hours * 60 + minutes) * 60_000;
  if (totalMs <= 0) return { error: "La duración debe ser mayor a cero" };

  const stoppedAt = new Date();
  const startedAt = new Date(stoppedAt.getTime() - totalMs);

  await prisma.taskTimeEntry.create({
    data: { taskId, userId: session.user.id, startedAt, stoppedAt },
  });

  revalidate(taskId, projectId);
  return { success: true };
}

export async function deleteTaskTimeEntry(
  entryId: string,
  taskId: string,
  projectId: string,
) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  await prisma.taskTimeEntry.delete({ where: { id: entryId } });

  revalidate(taskId, projectId);
  return { success: true };
}

export async function resetTaskTimeEntries(taskId: string, projectId: string) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  await prisma.taskTimeEntry.deleteMany({ where: { taskId } });

  revalidate(taskId, projectId);
  return { success: true };
}
