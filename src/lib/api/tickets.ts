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
import { isPlanExpired } from "@/lib/plans";
import { getClientActivePlan } from "@/lib/plans.server";
import { getPlanUsedHours } from "@/lib/time-entries";
import { ticketCode, ticketPrefix } from "@/lib/ticket-code";
import { notify, notifyMany } from "@/lib/notify";
import { canAccessTicket } from "@/lib/ticket-access";
import { canOpenModule } from "@/lib/access/can";
import { emitTicketHook } from "@/lib/hooks/dispatch";
import { afterTicketStatusChange } from "@/lib/status-change";
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
    // Sin el módulo no hay nada que listar: un `in: []` no devuelve filas.
    if (!(await canOpenModule(user, "TICKETS"))) return { id: { in: [] } };
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

// ─── Cliente, plan y empresa ─────────────────────────────────────────────────

/** `undefined` deja el campo como está; `null` lo vacía. */
export type TicketLinksInput = {
  clientId?: string | null;
  planId?: string | null;
  /**
   * El ticket no guarda empresa: se le reconoce por su plan y, sin plan, por su
   * cliente. Indicarla sirve para dos cosas: comprobar que el cliente y el plan
   * son de ella, y —si no se dijo qué plan— tomar el que tenga vigente.
   */
  companyId?: string;
};

/** Planes de la empresa contra los que hoy se puede abrir trabajo. */
export async function activePlansOfCompany(companyId: string) {
  const plans = await prisma.plan.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true, name: true, type: true, totalHours: true, durationDays: true,
      startedAt: true, expiresAt: true, isActive: true,
    },
    orderBy: { startedAt: "desc" },
  });

  const valid: typeof plans = [];
  for (const plan of plans) {
    if (isPlanExpired(plan)) continue;
    if (plan.type === "BOLSA_HORAS" && plan.totalHours !== null) {
      if ((await getPlanUsedHours(plan.id)) >= plan.totalHours) continue;
    }
    valid.push(plan);
  }
  return valid;
}

/**
 * Valida lo que se pide vincular y lo deja listo para guardar.
 *
 * La interfaz no necesita esto porque sus desplegables ya solo ofrecen lo que
 * encaja; aquí llegan ids sueltos y hay que comprobar que existen y que no se
 * contradicen entre sí.
 */
async function resolveTicketLinks(input: TicketLinksInput): Promise<
  WriteResult<{ clientId: string | null | undefined; planId: string | null | undefined; companyName: string | null }>
> {
  let company: { id: string; name: string } | null = null;
  if (input.companyId) {
    company = await prisma.company.findUnique({
      where: { id: input.companyId },
      select: { id: true, name: true },
    });
    if (!company) return { ok: false, status: 404, error: "La empresa no existe." };
  }

  let planId = input.planId;
  let planCompanyName: string | null = null;
  if (typeof planId === "string") {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { companyId: true, company: { select: { name: true } } },
    });
    if (!plan) return { ok: false, status: 404, error: "El plan no existe." };
    if (company && plan.companyId !== company.id) {
      return { ok: false, status: 422, error: `Ese plan no es de «${company.name}».` };
    }
    planCompanyName = plan.company.name;
  }

  let clientCompanyName: string | null = null;
  if (typeof input.clientId === "string") {
    const client = await prisma.user.findFirst({
      where: { id: input.clientId, role: "CLIENTE", isActive: true },
      select: { companies: { select: { id: true, name: true } } },
    });
    if (!client) {
      return { ok: false, status: 404, error: "El cliente no existe, está inactivo o no es un usuario cliente." };
    }
    if (company && !client.companies.some((c) => c.id === company.id)) {
      return { ok: false, status: 422, error: `Ese cliente no pertenece a «${company.name}».` };
    }
    clientCompanyName = client.companies[0]?.name ?? null;
  }

  // Empresa sin plan explícito: el que tenga vigente, si no hay duda de cuál
  if (company && planId === undefined) {
    const vigentes = await activePlansOfCompany(company.id);
    if (vigentes.length === 1) {
      planId = vigentes[0].id;
      planCompanyName = company.name;
    } else if (vigentes.length > 1) {
      const opciones = vigentes.map((p) => `${p.name} (${p.id})`).join(", ");
      return {
        ok: false,
        status: 422,
        error: `«${company.name}» tiene varios planes vigentes; indica planId. Opciones: ${opciones}.`,
      };
    } else if (typeof input.clientId !== "string") {
      return {
        ok: false,
        status: 422,
        error:
          `«${company.name}» no tiene un plan vigente. Un ticket se vincula a una empresa por su plan o por ` +
          "su cliente: indica un clientId de esa empresa, o un planId concreto.",
      };
    } else {
      // Queda vinculado solo por el cliente; un plan de otra empresa lo contradiría
      planId = null;
    }
  }

  return {
    ok: true,
    value: {
      clientId: input.clientId,
      planId,
      companyName: planCompanyName ?? clientCompanyName ?? company?.name ?? null,
    },
  };
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
  /** Solo el equipo. Un cliente abre el ticket a su nombre y contra su plan. */
  clientId?: string | null;
  planId?: string | null;
  companyId?: string;
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

  let clientId: string | null = isClient ? author.id : null;
  let companyName: string | null = null;

  if (input.clientId || input.planId || input.companyId) {
    if (isClient) {
      return { ok: false, status: 403, error: "Un cliente no puede elegir el cliente, el plan ni la empresa del ticket." };
    }
    const links = await resolveTicketLinks({
      clientId: input.clientId ?? undefined,
      planId: input.planId ?? undefined,
      companyId: input.companyId,
    });
    if (!links.ok) return links;
    clientId = links.value.clientId ?? null;
    planId = links.value.planId ?? null;
    companyName = links.value.companyName;
  }

  // El prefijo sale de la empresa dueña del plan; si no hay plan, de la del
  // cliente; y si el equipo no vinculó nada, de la primera empresa del autor.
  if (planId && !companyName) {
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
        clientId,
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
} & TicketLinksInput;

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
      client: { select: { name: true, email: true } },
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

  // El código del ticket no cambia aunque cambie de empresa: ya se compartió
  const links = await resolveTicketLinks({
    clientId: input.clientId,
    planId: input.planId,
    companyId: input.companyId,
  });
  if (!links.ok) return links;

  const updated = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...(links.value.clientId !== undefined ? { clientId: links.value.clientId } : {}),
      ...(links.value.planId !== undefined ? { planId: links.value.planId } : {}),
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
    // Campana, Google Chat, revisores, correo al cliente y cronómetros: lo
    // mismo que al cambiar el estado desde la plataforma
    await afterTicketStatusChange({
      ticketId,
      title: updated.title,
      from: before.status,
      to: input.status,
      actorId: author.id,
      clientId: before.clientId,
      createdById: before.createdById,
      assignedToId: before.assignedToId,
      client: before.client,
    });
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
