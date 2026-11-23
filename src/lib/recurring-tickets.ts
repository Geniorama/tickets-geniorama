/**
 * Abrir el ticket que toca de una recurrencia.
 *
 * Vive fuera de la Server Action para poder llamarlo desde los dos sitios que
 * lo necesitan —el barrido diario y el botón «Generar ahora»— sin que uno tenga
 * que pedir sesión por el otro. Es la misma separación que hizo `billing/move`.
 *
 * El ticket que sale de aquí es **un ticket normal**: mismo prefijo, mismo
 * consecutivo, mismos avisos y mismo evento hacia los hooks. Si se apartara en
 * algo, la recurrencia dejaría de ser «lo mismo pero solo», que es justo lo que
 * se le pide.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, RecurringTicketTemplate } from "@/generated/prisma";
import { ticketPrefix } from "@/lib/ticket-code";
import { computeNextRunAt } from "@/lib/recurrence";
import { normalizeChecklistGroups } from "@/lib/checklist";
import { createChecklistGroups } from "@/lib/checklists";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { sendTicketAssignedEmail } from "@/lib/email";
import { emitTicketHook } from "@/lib/hooks/dispatch";
import { format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { recordActivity } from "@/lib/activity/record";
import { es } from "date-fns/locale";

const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000";

/**
 * El prefijo de un ticket sale de la empresa dueña, y esa se busca igual que en
 * la creación manual: primero por el plan, y si no hay, por la empresa del
 * cliente. Duplicar el criterio haría que un mismo cliente acabara con dos
 * series de códigos según por dónde entró el ticket.
 */
async function resolverPrefijo(
  tpl: Pick<RecurringTicketTemplate, "planId" | "clientId">,
): Promise<string> {
  let companyName: string | null = null;

  if (tpl.planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: tpl.planId },
      select: { company: { select: { name: true } } },
    });
    companyName = plan?.company?.name ?? null;
  }

  if (!companyName && tpl.clientId) {
    const client = await prisma.user.findUnique({
      where: { id: tpl.clientId },
      select: { companies: { select: { name: true }, take: 1 } },
    });
    companyName = client?.companies[0]?.name ?? null;
  }

  return ticketPrefix(companyName);
}

/** El siguiente número de la serie de ese prefijo. */
async function siguienteNumero(tx: Prisma.TransactionClient, prefix: string): Promise<number> {
  const last = await tx.ticket.findFirst({
    where: { prefix },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}

/**
 * Avanza la programación encadenando desde `nextRunAt` y no desde ahora.
 *
 * Importa cuando el barrido se salta un día o alguien genera a mano: la cadencia
 * la marca el calendario previsto, no el momento en que se ejecutó. Si no, una
 * mensual atendida con dos días de retraso se iría corriendo mes a mes.
 */
export function avanzarProgramacion(tpl: RecurringTicketTemplate, ahora: Date): Date {
  const pattern = {
    frequency: tpl.frequency,
    interval: tpl.interval,
    daysOfWeek: tpl.daysOfWeek,
    dayOfMonth: tpl.dayOfMonth,
  };

  let next = tpl.nextRunAt;
  if (next.getTime() <= ahora.getTime()) {
    do {
      next = computeNextRunAt(next, pattern);
    } while (next.getTime() <= ahora.getTime());
  }
  return next;
}

/**
 * Cuándo empieza el periodo en el que cae `ahora`, según la frecuencia:
 * día, semana (desde el lunes) o mes calendario.
 */
export function inicioDelPeriodo(tpl: Pick<RecurringTicketTemplate, "frequency">, ahora: Date): Date {
  if (tpl.frequency === "DIARIA") return startOfDay(ahora);
  if (tpl.frequency === "MENSUAL") return startOfMonth(ahora);
  return startOfWeek(ahora, { weekStartsOn: 1 });
}

export type TicketGenerado ={ id: string; title: string; url: string };

/**
 * Crea el ticket y adelanta la programación, todo en una transacción.
 *
 * Los avisos van fuera y después: anunciar en Google Chat un ticket que luego
 * revierte es peor que no anunciarlo.
 *
 * `actorId` es quien queda como autor. El barrido usa el creador de la
 * plantilla; el botón «Generar ahora», a quien lo pulsa — así el historial
 * distingue el ticket que salió solo del que alguien adelantó.
 */
export async function generarTicketRecurrente(
  tpl: RecurringTicketTemplate,
  actorId: string,
  opciones: { ahora?: Date; avanzar?: boolean; forzar?: boolean } = {},
): Promise<TicketGenerado | null> {
  const ahora = opciones.ahora ?? new Date();

  // Un periodo, una instancia. Una semanal con varios días marcados (mar y mié)
  // «tocaba» dos veces por semana y abría HS-22 y HS-23 seguidos. Si ya hay una
  // instancia abierta de este periodo no se abre otra, pero la programación sí
  // avanza: si no, el barrido volvería a intentarlo cada día.
  // `forzar` (el botón «Generar ahora») salta la guarda: ahí es una persona
  // quien decide abrir otra, y sabe lo que hace.
  if (!opciones.forzar) {
    const existente = await prisma.ticket.findFirst({
      where: {
        recurringTemplateId: tpl.id,
        status: { notIn: ["CERRADO", "ANULADO"] },
        createdAt: { gte: inicioDelPeriodo(tpl, ahora) },
      },
      select: { id: true },
    });
    if (existente) {
      if (opciones.avanzar !== false) {
        await prisma.recurringTicketTemplate.updateMany({
          where: { id: tpl.id, nextRunAt: tpl.nextRunAt },
          data: { nextRunAt: avanzarProgramacion(tpl, ahora) },
        });
      }
      return null;
    }
  }

  const prefix = await resolverPrefijo(tpl);

  const dueDate =
    tpl.dueDateOffsetDays > 0
      ? new Date(ahora.getTime() + tpl.dueDateOffsetDays * 86400000)
      : null;

  // Un revisor que ya no está activo no puede recibir el ticket; se filtra en
  // vez de fallar, porque la baja de una persona no debe romper una
  // programación mensual que por lo demás sigue siendo válida.
  const revisores =
    tpl.reviewerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: tpl.reviewerIds }, isActive: true },
          select: { id: true },
        })
      : [];

  const ticket = await prisma.$transaction(async (tx) => {
    // Reclamar la ejecución antes de crear: dos barridos simultáneos (reintento
    // del workflow, doble disparo) leen la misma plantilla, pero solo uno logra
    // mover `nextRunAt` desde el valor que leyó. El otro no crea nada.
    if (opciones.avanzar !== false) {
      const reclamada = await tx.recurringTicketTemplate.updateMany({
        where: { id: tpl.id, nextRunAt: tpl.nextRunAt },
        data: { lastRunAt: ahora, nextRunAt: avanzarProgramacion(tpl, ahora) },
      });
      if (reclamada.count === 0) return null;
    }

    const created = await tx.ticket.create({
      data: {
        title: tpl.title,
        description: tpl.description,
        priority: tpl.priority,
        category: tpl.category,
        assignedToId: tpl.assignedToId,
        clientId: tpl.clientId,
        planId: tpl.planId,
        siteId: tpl.siteId,
        createdById: actorId,
        recurringTemplateId: tpl.id,
        dueDate,
        prefix,
        number: await siguienteNumero(tx, prefix),
        ...(revisores.length > 0
          ? { reviewers: { connect: revisores.map((r) => ({ id: r.id })) } }
          : {}),
      },
      select: { id: true, title: true },
    });

    await createChecklistGroups(
      { entityType: "TICKET", entityId: created.id },
      normalizeChecklistGroups(tpl.checklist),
      actorId,
      tx,
    );

    return created;
  });

  if (!ticket) return null;

  return { id: ticket.id, title: ticket.title, url: `/tickets/${ticket.id}` };
}

/**
 * Los avisos de un ticket recién nacido de una recurrencia.
 *
 * Se separan de la creación para que un fallo de correo no revierta el ticket,
 * y para que quien llame decida cuándo son seguros de mandar.
 */
export async function avisarTicketRecurrente(
  tpl: RecurringTicketTemplate & { assignedTo?: { name: string } | null },
  ticket: TicketGenerado,
  autorNombre: string,
): Promise<void> {
  const partes: string[] = [`"${ticket.title}"`];
  if (tpl.assignedTo?.name) partes.push(`Asignado a: ${tpl.assignedTo.name}`);
  if (tpl.dueDateOffsetDays > 0) {
    const vence = new Date(Date.now() + tpl.dueDateOffsetDays * 86400000);
    partes.push(`Vence: ${format(vence, "d MMM yyyy", { locale: es })}`);
  }

  await sendGChatNotification(
    "ticket_new",
    "Nuevo ticket recurrente",
    `${autorNombre} programó: ${partes.join(" · ")}`,
    ticket.url,
  ).catch(() => {});

  // A quien lo recibe: campana, su webhook personal y push. `skipGChat` porque
  // el canal del equipo ya se enteró arriba.
  if (tpl.assignedToId) {
    await notify(
      tpl.assignedToId,
      "ticket_assigned",
      "Ticket recurrente asignado",
      `Se te asignó: "${ticket.title}"`,
      ticket.url,
      true,
    ).catch(() => {});
  }

  // Y al cliente, que es lo que se decidió: un ticket recurrente le llega igual
  // que uno que abriera una persona. Solo cuando ya nace con responsable —un
  // ticket sin asignar no tiene nada que contarle todavía—.
  if (tpl.clientId && tpl.assignedToId) {
    const cliente = await prisma.user
      .findUnique({ where: { id: tpl.clientId }, select: { name: true, email: true } })
      .catch(() => null);
    if (cliente) {
      await sendTicketAssignedEmail(
        cliente,
        ticket.title,
        `${APP_URL}${ticket.url}`,
      ).catch(() => {});
    }
  }

  // El canal externo, que además deja la entrada en el historial del ticket.
  emitTicketHook("ticket.created", ticket.id, {
    actor: { id: tpl.createdById, name: autorNombre },
  });

  // Y la marca de origen: sin ella «creado por Angel» no distingue el ticket
  // que salió de la recurrencia del que abrió una persona.
  recordActivity({
    entityType: "TICKET",
    entityId: ticket.id,
    action: "ticket.recurrence_generated",
    label: ticket.title,
    meta: { templateId: tpl.id },
    actor: { id: tpl.createdById, name: autorNombre },
  });
}
