/**
 * Lectura y escritura de tickets desde la API pública.
 *
 * No reutiliza las Server Actions de `ticket.actions.ts` porque aquellas
 * arrancan con `getRequiredSession()` y terminan en `redirect()`: dan por hecho
 * que hay un navegador con cookie del otro lado, y aquí solo hay una llave. Es
 * el mismo camino que ya tomó la integración de briefs.
 *
 * Lo que sí se conserva es el contrato de negocio: prefijo por empresa,
 * consecutivo dentro de la transacción, plan activo obligatorio para clientes,
 * estado POR_ASIGNAR y los mismos avisos que recibe el equipo cuando alguien
 * abre un ticket desde la plataforma. Un ticket creado por API es un ticket
 * normal, indistinguible del resto.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, Priority, TicketStatus } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { getClientActivePlan } from "@/lib/plans.server";
import { ticketCode, ticketPrefix } from "@/lib/ticket-code";
import { notify, notifyMany } from "@/lib/notify";
import { canAccessTicket } from "@/lib/ticket-access";
import { emitTicketHook } from "@/lib/hooks/dispatch";
import { serializeTicket, ticketSelect } from "@/lib/hooks/payload";
import type { ApiUser } from "@/lib/api/respond";

export type WriteResult<T> = { ok: true; value: T } | { ok: false; error: string; status: number };

/** Marca de origen que queda en el ticket para que el equipo sepa por dónde entró. */
function sourceNote(keyLabel: string): string {
  return `_Creado desde la integración «${keyLabel}»._`;
}

// ─── Frontera de datos ───────────────────────────────────────────────────────

/**
 * Los tickets que este usuario puede ver, expresado como filtro de Prisma.
 *
 * Repite la regla de `canAccessTicket` en forma de `where` porque un listado no
 * puede resolverse ticket a ticket: filtrar en memoria significaría traerlos
 * todos primero, y eso ya es la filtración que se quiere evitar.
 */
export async function ticketScopeWhere(user: ApiUser): Promise<Prisma.TicketWhereInput> {
  if (isStaff(user.role)) {
    return { OR: [{ isDraft: false }, { createdById: user.id }] };
  }

  const withCompanies = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      companies: {
        select: { users: { where: { role: "CLIENTE" }, select: { id: true } } },
      },
    },
  });

  const companyClientIds = [
    ...new Set((withCompanies?.companies ?? []).flatMap((c) => c.users.map((u) => u.id))),
  ];
  const clientIds = companyClientIds.length > 0 ? companyClientIds : [user.id];

  return {
    isDraft: false,
    OR: [{ createdById: user.id }, { clientId: { in: clientIds } }],
  };
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function listTickets(
  user: ApiUser,
  opts: { limit: number; cursor: string | null; status?: string; assignedToId?: string },
) {
  const scope = await ticketScopeWhere(user);

  const where: Prisma.TicketWhereInput = {
    AND: [
      scope,
      ...(opts.status ? [{ status: opts.status as TicketStatus }] : []),
      ...(opts.assignedToId ? [{ assignedToId: opts.assignedToId }] : []),
    ],
  };

  const rows = await prisma.ticket.findMany({
    where,
    select: ticketSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    tickets: page.map(serializeTicket),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getTicket(user: ApiUser, ticketId: string) {
  if (!(await canAccessTicket(ticketId, user.id, user.role))) return null;
  const row = await prisma.ticket.findUnique({ where: { id: ticketId }, select: ticketSelect });
  return row ? serializeTicket(row) : null;
}

// ─── Creación ────────────────────────────────────────────────────────────────

export type CreateTicketInput = {
  title: string;
  description: string;
  priority?: Priority;
  /**
   * Solo el equipo puede elegirlo. Sin él, el ticket nace POR_ASIGNAR: lo que
   * entra por una integración no tiene dueño todavía y hay que triarlo.
   */
  status?: TicketStatus;
  category?: string | null;
  assignedToId?: string | null;
  siteId?: string | null;
  dueDate?: Date | null;
};

export async function createTicketViaApi(
  author: ApiUser,
  keyLabel: string,
  input: CreateTicketInput,
): Promise<WriteResult<ReturnType<typeof serializeTicket>>> {
  const isClient = !isStaff(author.role);

  // Los clientes solo pueden abrir tickets contra un plan vigente: es el mismo
  // freno que aplica la plataforma. Por API importa más, porque una integración
  // puede pedir trabajo sin que nadie se dé cuenta de que el plan se venció.
  let planId: string | null = null;
  if (isClient) {
    const plan = await getClientActivePlan(author.id);
    if (!plan) {
      return {
        ok: false,
        status: 422,
        error: `${author.name} no tiene un plan activo, así que no se puede abrir el ticket.`,
      };
    }
    planId = plan.id;
  }

  // Un cliente no elige el estado de lo que abre, igual que en la interfaz.
  if (isClient && input.status && input.status !== "POR_ASIGNAR") {
    return { ok: false, status: 403, error: "Un cliente no puede elegir el estado del ticket." };
  }
  const status: TicketStatus = isClient ? "POR_ASIGNAR" : (input.status ?? "POR_ASIGNAR");

  if (input.assignedToId) {
    if (isClient) {
      return { ok: false, status: 403, error: "Un cliente no puede asignar tickets." };
    }
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      return { ok: false, status: 404, error: "El usuario asignado no existe o está inactivo." };
    }
  }

  // El prefijo sale de la empresa dueña del plan; si no hay plan (staff), de la
  // primera empresa del usuario.
  let companyName: string | null = null;
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { company: { select: { name: true } } },
    });
    companyName = plan?.company?.name ?? null;
  }
  if (!companyName) {
    const withCompany = await prisma.user.findUnique({
      where: { id: author.id },
      select: { companies: { select: { name: true }, take: 1 } },
    });
    companyName = withCompany?.companies[0]?.name ?? null;
  }
  const prefix = ticketPrefix(companyName);

  const created = await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.ticket.create({
      data: {
        title: input.title.slice(0, 200),
        description: `${input.description.trim()}\n\n${sourceNote(keyLabel)}`,
        priority: input.priority ?? "MEDIA",
        category: input.category ?? null,
        status,
        clientId: isClient ? author.id : null,
        createdById: author.id,
        assignedToId: input.assignedToId ?? null,
        siteId: input.siteId ?? null,
        dueDate: isClient ? null : (input.dueDate ?? null),
        planId,
        prefix,
        number: (last?.number ?? 0) + 1,
        // Sin revisores explícitos, el creador queda como revisor — igual que
        // hace `resolveReviewerIds` en la acción de la plataforma.
        reviewers: { connect: [{ id: author.id }] },
      },
      select: ticketSelect,
    });
  });

  const code = ticketCode(created.prefix, created.number);
  const link = `/tickets/${created.id}`;

  const admins = await prisma.user.findMany({
    where: { role: "ADMINISTRADOR", isActive: true },
    select: { id: true },
  });
  await notifyMany(
    admins.map((a) => a.id).filter((id) => id !== author.id),
    "ticket_new",
    "Nuevo ticket por integración",
    `${author.name} abrió ${code}: "${created.title}"`,
    link,
  );

  if (created.assignedTo && created.assignedTo.id !== author.id) {
    await notify(
      created.assignedTo.id,
      "ticket_assigned",
      "Ticket asignado",
      `Se te asignó: "${created.title}"`,
      link,
      true,
    );
  }

  emitTicketHook("ticket.created", created.id, { actor: { id: author.id, name: author.name } });

  return { ok: true, value: serializeTicket(created) };
}

// ─── Actualización ───────────────────────────────────────────────────────────

export type UpdateTicketInput = {
  title?: string;
  description?: string;
  status?: TicketStatus;
  priority?: Priority;
  category?: string | null;
  assignedToId?: string | null;
  dueDate?: Date | null;
};

export async function updateTicketViaApi(
  author: ApiUser,
  ticketId: string,
  input: UpdateTicketInput,
): Promise<WriteResult<ReturnType<typeof serializeTicket>>> {
  // Cambiar un ticket es cosa del equipo: un cliente que puede leerlo no puede
  // reasignarlo ni cerrarlo, igual que en la interfaz.
  if (!isStaff(author.role)) {
    return { ok: false, status: 403, error: "Solo el equipo puede modificar tickets." };
  }

  const before = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      status: true,
      assignedToId: true,
      createdById: true,
      clientId: true,
    },
  });
  if (!before) return { ok: false, status: 404, error: "Ticket no encontrado" };

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) {
      return { ok: false, status: 404, error: "El usuario asignado no existe o está inactivo." };
    }
  }

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(input.title !== undefined ? { title: input.title.slice(0, 200) } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
    },
    select: ticketSelect,
  });

  const actor = { id: author.id, name: author.name };
  const link = `/tickets/${ticketId}`;

  if (input.status !== undefined && input.status !== before.status) {
    const recipients = [before.clientId, before.createdById, before.assignedToId].filter(
      (id): id is string => !!id && id !== author.id,
    );
    await notifyMany(
      recipients,
      "ticket_status",
      "Ticket actualizado",
      `"${updated.title}" cambió de estado`,
      link,
    );
    emitTicketHook("ticket.status_changed", ticketId, {
      actor,
      changes: { status: { from: before.status, to: input.status } },
    });
  }

  if (input.assignedToId !== undefined && input.assignedToId !== before.assignedToId) {
    if (input.assignedToId && input.assignedToId !== author.id) {
      await notify(
        input.assignedToId,
        "ticket_assigned",
        "Ticket asignado",
        `Se te asignó: "${updated.title}"`,
        link,
        true,
      );
    }
    emitTicketHook("ticket.assigned", ticketId, {
      actor,
      changes: { assignedToId: { from: before.assignedToId, to: input.assignedToId } },
    });
  }

  emitTicketHook("ticket.updated", ticketId, { actor });

  return { ok: true, value: serializeTicket(updated) };
}
