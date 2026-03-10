"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";

export async function startTimer(ticketId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const active = await prisma.timeEntry.findFirst({
    where: { ticketId, stoppedAt: null },
  });
  if (active) return { error: "Ya hay un contador activo para este ticket" };

  await prisma.timeEntry.create({
    data: {
      ticketId,
      userId: session.user.id,
      startedAt: new Date(),
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function pauseTimer(ticketId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const active = await prisma.timeEntry.findFirst({
    where: { ticketId, stoppedAt: null },
  });
  if (!active) return { error: "No hay un contador activo" };

  await prisma.timeEntry.update({
    where: { id: active.id },
    data: { stoppedAt: new Date() },
  });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteTimeEntry(entryId: string, ticketId: string) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  await prisma.timeEntry.delete({ where: { id: entryId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function resetTimeEntries(ticketId: string) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  await prisma.timeEntry.deleteMany({ where: { ticketId } });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function addManualEntry(ticketId: string, hours: number, minutes: number) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role)) return { error: "Sin permisos" };

  const totalMs = (hours * 60 + minutes) * 60_000;
  if (totalMs <= 0) return { error: "La duración debe ser mayor a cero" };

  const stoppedAt = new Date();
  const startedAt = new Date(stoppedAt.getTime() - totalMs);

  await prisma.timeEntry.create({
    data: { ticketId, userId: session.user.id, startedAt, stoppedAt },
  });

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
