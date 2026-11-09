/**
 * Tickets «sin movimiento»: activos pero quietos.
 *
 * Un ticket En progreso puede pasar semanas sin que nadie lo note (HS-7 desde el
 * 11-sep, HS-5 desde el 13-oct…). Aquí se detectan para avisar y para poder
 * filtrarlos en la lista.
 *
 * «Movimiento» es cualquier señal de vida, no solo editar el ticket:
 *   · el propio ticket (`updatedAt`)
 *   · un comentario nuevo
 *   · una entrada del historial (cambio de estado, asignación…)
 *   · tiempo registrado, o un cronómetro corriendo ahora mismo
 *
 * Solo cuentan ABIERTO y EN_PROGRESO. Por Asignar espera a que alguien lo tome y
 * En revisión espera la respuesta del cliente (ver AG·P-2): ahí «quieto» es
 * esperado, y avisar sería ruido.
 */

import { prisma } from "@/lib/prisma";

export const STALE_DAYS = 5;
const ACTIVE_STATUSES = ["ABIERTO", "EN_PROGRESO"] as const;
const DAY_MS = 86_400_000;

export type StaleTicket = {
  id: string;
  title: string;
  status: string;
  priority: string;
  prefix: string | null;
  number: number;
  assignedTo: { id: string; name: string } | null;
  lastActivity: Date;
  daysIdle: number;
};

export async function findStaleTickets({
  days = STALE_DAYS,
  limit = 500,
}: { days?: number; limit?: number } = {}): Promise<StaleTicket[]> {
  const now = Date.now();
  const cutoff = new Date(now - days * DAY_MS);

  // Primer filtro barato: si ni el propio ticket se ha tocado, vale la pena mirar el resto.
  const candidates = await prisma.ticket.findMany({
    where: { isDraft: false, status: { in: [...ACTIVE_STATUSES] }, updatedAt: { lt: cutoff } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      prefix: true,
      number: true,
      updatedAt: true,
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });
  if (candidates.length === 0) return [];

  const ids = candidates.map((t) => t.id);
  const entity = { entityType: "TICKET" as const, entityId: { in: ids } };

  const [comments, activity, times, running] = await Promise.all([
    prisma.comment.groupBy({ by: ["entityId"], where: entity, _max: { createdAt: true } }),
    prisma.activityLog.groupBy({ by: ["entityId"], where: entity, _max: { createdAt: true } }),
    prisma.timeEntry.groupBy({ by: ["entityId"], where: entity, _max: { startedAt: true, stoppedAt: true } }),
    prisma.timeEntry.findMany({ where: { ...entity, stoppedAt: null }, select: { entityId: true } }),
  ]);

  const last = new Map<string, number>();
  const bump = (id: string, d: Date | null | undefined) => {
    if (d) last.set(id, Math.max(last.get(id) ?? 0, d.getTime()));
  };
  for (const t of candidates) bump(t.id, t.updatedAt);
  for (const c of comments) bump(c.entityId, c._max.createdAt);
  for (const a of activity) bump(a.entityId, a._max.createdAt);
  for (const t of times) {
    bump(t.entityId, t._max.startedAt);
    bump(t.entityId, t._max.stoppedAt);
  }
  // Un cronómetro abierto es alguien trabajando ahora mismo.
  for (const r of running) last.set(r.entityId, now);

  return candidates
    .map((t) => {
      const ts = last.get(t.id) ?? t.updatedAt.getTime();
      return {
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        prefix: t.prefix,
        number: t.number,
        assignedTo: t.assignedTo,
        lastActivity: new Date(ts),
        daysIdle: Math.floor((now - ts) / DAY_MS),
      };
    })
    .filter((t) => t.lastActivity.getTime() < cutoff.getTime())
    .sort((a, b) => b.daysIdle - a.daysIdle);
}
