/**
 * Núcleo compartido — registros de tiempo.
 *
 * Una sola implementación del cronómetro para tickets, tareas y lo que venga.
 * Es la base de la facturación: el consumo de horas de un plan sale de aquí.
 *
 * Contrato: sin clave foránea hacia la entidad, la base no borra los registros
 * al eliminar el ticket o la tarea. Usa `deleteTimeEntriesFor()`.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";

type Entity = { entityType: EntityType; entityId: string };

export type TimeEntryWithUser = Prisma.TimeEntryGetPayload<{
  include: { user: { select: { name: true } } };
}>;

/** Milisegundos acumulados por las entradas cerradas. Las abiertas no cuentan. */
export function totalElapsedMs(entries: { startedAt: Date; stoppedAt: Date | null }[]): number {
  return entries.reduce(
    (acc, e) => (e.stoppedAt ? acc + (e.stoppedAt.getTime() - e.startedAt.getTime()) : acc),
    0,
  );
}

export function listTimeEntries(entity: Entity, take = 200): Promise<TimeEntryWithUser[]> {
  return prisma.timeEntry.findMany({
    where: entity,
    take,
    orderBy: { startedAt: "asc" },
    include: { user: { select: { name: true } } },
  });
}

/** El contador en marcha de una entidad, si lo hay. */
export function findRunningEntry(entity: Entity) {
  return prisma.timeEntry.findFirst({ where: { ...entity, stoppedAt: null } });
}

export async function startTimer(entity: Entity, userId: string) {
  const active = await findRunningEntry(entity);
  if (active) return { error: "Ya hay un contador activo" };

  await prisma.timeEntry.create({
    data: { ...entity, userId, startedAt: new Date() },
  });
  return {};
}

export async function pauseTimer(entity: Entity) {
  const active = await findRunningEntry(entity);
  if (!active) return { error: "No hay un contador activo" };

  await prisma.timeEntry.update({
    where: { id: active.id },
    data: { stoppedAt: new Date() },
  });
  return {};
}

/** Entrada manual: se registra hacia atrás desde ahora. */
export async function addManualEntry(
  entity: Entity,
  userId: string,
  hours: number,
  minutes: number,
) {
  const totalMs = (hours * 60 + minutes) * 60_000;
  if (totalMs <= 0) return { error: "La duración debe ser mayor a cero" };

  const stoppedAt = new Date();
  const startedAt = new Date(stoppedAt.getTime() - totalMs);

  await prisma.timeEntry.create({ data: { ...entity, userId, startedAt, stoppedAt } });
  return {};
}

/** Borrado acotado a la entidad: un id suelto no puede tocar el tiempo de otra. */
export async function deleteTimeEntry(entity: Entity, entryId: string) {
  await prisma.timeEntry.deleteMany({ where: { id: entryId, ...entity } });
}

export async function resetTimeEntries(entity: Entity) {
  await prisma.timeEntry.deleteMany({ where: entity });
}

/** Detiene el contador en marcha de una entidad, si lo hay. */
export function stopRunningForEntity(entity: Entity, at: Date = new Date()) {
  return prisma.timeEntry.updateMany({
    where: { ...entity, stoppedAt: null },
    data: { stoppedAt: at },
  });
}

/**
 * Milisegundos cerrados acumulados por cada entidad de una lista, en una sola
 * consulta. Sustituye al `include: { timeEntries }` de los listados.
 */
export async function elapsedMsByEntity(
  entityType: EntityType,
  entityIds: string[],
): Promise<Map<string, number>> {
  const totals = new Map<string, number>();
  if (entityIds.length === 0) return totals;

  const rows = await prisma.timeEntry.findMany({
    where: { entityType, entityId: { in: entityIds }, stoppedAt: { not: null } },
    select: { entityId: true, startedAt: true, stoppedAt: true },
  });

  for (const row of rows) {
    const ms = row.stoppedAt!.getTime() - row.startedAt.getTime();
    totals.set(row.entityId, (totals.get(row.entityId) ?? 0) + ms);
  }

  return totals;
}

/** Detiene todos los contadores en marcha de un usuario. */
export function stopAllForUser(userId: string, at: Date = new Date()) {
  return prisma.timeEntry.updateMany({
    where: { userId, stoppedAt: null },
    data: { stoppedAt: at },
  });
}

/**
 * El contador en marcha del usuario, con el título de la entidad resuelto.
 * Antes salía de dos consultas con `include: { ticket }` / `include: { task }`;
 * ahora hay que resolver el título aparte porque la relación ya no existe.
 */
export async function findRunningTimerForUser(userId: string) {
  const entry = await prisma.timeEntry.findFirst({
    where: { userId, stoppedAt: null },
    orderBy: { startedAt: "asc" },
    select: { entityType: true, entityId: true, startedAt: true },
  });
  if (!entry) return null;

  if (entry.entityType === "TICKET") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: entry.entityId },
      select: { id: true, title: true },
    });
    if (!ticket) return null;
    return { type: "ticket" as const, id: ticket.id, title: ticket.title, projectId: null, startedAt: entry.startedAt };
  }

  if (entry.entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: entry.entityId },
      select: { id: true, title: true, projectId: true },
    });
    if (!task) return null;
    return { type: "task" as const, id: task.id, title: task.title, projectId: task.projectId, startedAt: entry.startedAt };
  }

  return null;
}

/**
 * Horas consumidas por un plan: suma de las entradas cerradas de sus tickets.
 *
 * Antes era un filtro anidado (`where: { ticket: { planId } }`) sobre la
 * relación directa. Sin ella hay que resolver primero los tickets del plan.
 */
export async function getPlanUsedHours(planId: string): Promise<number> {
  const ticketIds = (
    await prisma.ticket.findMany({ where: { planId }, select: { id: true } })
  ).map((t) => t.id);

  if (ticketIds.length === 0) return 0;

  const entries = await prisma.timeEntry.findMany({
    where: {
      entityType: "TICKET",
      entityId: { in: ticketIds },
      stoppedAt: { not: null },
    },
    select: { startedAt: true, stoppedAt: true },
  });

  return totalElapsedMs(entries) / 3_600_000;
}

/** Reemplazo del borrado en cascada que daba la clave foránea. */
export function deleteTimeEntriesFor(
  entityType: EntityType,
  entityIds: string | string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return Promise.resolve({ count: 0 });

  return client.timeEntry.deleteMany({
    where: { entityType, entityId: { in: ids } },
  });
}
