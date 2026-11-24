import { prisma } from "@/lib/prisma";
import type { Periodo } from "@/lib/billing/categories";
import type { TicketStatus, TaskStatus } from "@/generated/prisma";

/**
 * Lo operativo del tablero gerencial: Tickets, Proyectos y tareas,
 * Infraestructura y CRM, para cruzarlo con lo financiero.
 *
 * «Abierto» en tickets excluye Cerrado y Anulado. «Vencido» además excluye
 * «En espera del cliente»: el reloj está detenido y no es culpa del equipo.
 */

const ABIERTOS: TicketStatus[] = ["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "ESPERA_CLIENTE"];
const CORRIENDO: TicketStatus[] = ["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION"];
const TAREAS_ABIERTAS: TaskStatus[] = ["PENDIENTE", "EN_PROGRESO", "EN_REVISION"];

const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const DIA = 864e5;

async function nombres(ids: (string | null)[]) {
  const limpios = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  const us = await prisma.user.findMany({ where: { id: { in: limpios } }, select: { id: true, name: true } });
  return new Map(us.map((u) => [u.id, u.name]));
}

export async function cargarOperacion(periodo: Periodo) {
  const ahora = new Date();
  const en30 = new Date(ahora.getTime() + 30 * DIA);
  const desdeSerie = new Date(periodo.hasta.getFullYear(), periodo.hasta.getMonth() - 5, 1);

  const [
    porEstado, porPrioridad, porResp, vencidos, criticos, creados,
    tareasPorEstado, tareasVencidas, tareasResp, proyectosActivos, proyectosVencidos,
    horas, servicios, sitios, cuentas,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: { isDraft: false, status: { in: ABIERTOS } }, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["priority"], where: { isDraft: false, status: { in: ABIERTOS } }, _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ["assignedToId"], where: { isDraft: false, status: { in: ABIERTOS } }, _count: { _all: true } }),
    prisma.ticket.count({ where: { isDraft: false, status: { in: CORRIENDO }, dueDate: { lt: ahora } } }),
    prisma.ticket.count({ where: { isDraft: false, status: { in: ABIERTOS }, priority: "CRITICA" } }),
    prisma.ticket.findMany({ where: { isDraft: false, createdAt: { gte: desdeSerie, lte: periodo.hasta } }, select: { createdAt: true } }),
    prisma.task.groupBy({ by: ["status"], where: { isDraft: false }, _count: { _all: true } }),
    prisma.task.count({ where: { isDraft: false, status: { in: TAREAS_ABIERTAS }, dueDate: { lt: ahora } } }),
    prisma.task.groupBy({ by: ["assignedToId"], where: { isDraft: false, status: { in: TAREAS_ABIERTAS } }, _count: { _all: true } }),
    prisma.project.count({ where: { isActive: true, isDraft: false } }),
    prisma.project.count({ where: { isActive: true, isDraft: false, dueDate: { lt: ahora } } }),
    prisma.timeEntry.findMany({
      where: { startedAt: { gte: periodo.desde, lte: periodo.hasta }, stoppedAt: { not: null } },
      select: { entityType: true, startedAt: true, stoppedAt: true },
    }),
    prisma.service.findMany({
      where: { isActive: true, dueDate: { not: null, lte: en30 } },
      orderBy: { dueDate: "asc" },
      select: { id: true, name: true, type: true, dueDate: true, price: true, company: { select: { name: true } } },
    }),
    prisma.site.count({ where: { isActive: true } }),
    prisma.company.groupBy({ by: ["stage"], _count: { _all: true } }),
  ]);

  const nom = await nombres([...porResp.map((r) => r.assignedToId), ...tareasResp.map((r) => r.assignedToId)]);
  const etiqueta = (id: string | null) => (id ? nom.get(id) ?? "—" : "Sin asignar");

  // Serie de tickets creados por mes.
  const serie: { mes: string; v: number }[] = [];
  for (let i = 0; i < 6; i++) serie.push({ mes: claveMes(new Date(desdeSerie.getFullYear(), desdeSerie.getMonth() + i, 1)), v: 0 });
  const idx = new Map(serie.map((s) => [s.mes, s]));
  for (const t of creados) { const f = idx.get(claveMes(t.createdAt)); if (f) f.v += 1; }

  // Horas trabajadas en el periodo, por tipo de ficha.
  let hTickets = 0, hTareas = 0;
  for (const h of horas) {
    const horasEntrada = ((h.stoppedAt as Date).getTime() - h.startedAt.getTime()) / 36e5;
    if (h.entityType === "TICKET") hTickets += horasEntrada;
    else if (h.entityType === "TASK") hTareas += horasEntrada;
  }

  const abiertos = porEstado.reduce((s, e) => s + e._count._all, 0);
  const sinAsignar = porEstado.find((e) => e.status === "POR_ASIGNAR")?._count._all ?? 0;
  const vencServ = servicios.filter((s) => s.dueDate && s.dueDate < ahora);

  return {
    tickets: {
      abiertos, vencidos, criticos, sinAsignar, serie,
      porEstado: porEstado.map((e) => ({ estado: e.status as string, v: e._count._all })),
      porPrioridad: porPrioridad.map((p) => ({ prioridad: p.priority as string, v: p._count._all })),
      porResponsable: porResp.map((r) => ({ nombre: etiqueta(r.assignedToId), v: r._count._all })).sort((a, b) => b.v - a.v).slice(0, 8),
    },
    proyectos: {
      activos: proyectosActivos, vencidos: proyectosVencidos, tareasVencidas,
      tareasAbiertas: tareasPorEstado.filter((t) => TAREAS_ABIERTAS.includes(t.status)).reduce((s, t) => s + t._count._all, 0),
      tareasPorEstado: tareasPorEstado.map((t) => ({ estado: t.status as string, v: t._count._all })),
      cargaPorResponsable: tareasResp.map((r) => ({ nombre: etiqueta(r.assignedToId), v: r._count._all })).sort((a, b) => b.v - a.v).slice(0, 8),
      horasTickets: hTickets, horasTareas: hTareas,
    },
    infraestructura: {
      sitios, vencidos: vencServ.length, porVencer: servicios.length - vencServ.length,
      valorRenovaciones: servicios.reduce((s, x) => s + (x.price ?? 0), 0),
      proximos: servicios.slice(0, 8).map((s) => ({
        id: s.id, nombre: s.name, tipo: s.type as string, empresa: s.company.name, vence: s.dueDate as Date, precio: s.price, vencido: (s.dueDate as Date) < ahora,
      })),
    },
    cuentas: cuentas.map((c) => ({ etapa: c.stage as string, v: c._count._all })),
  };
}
