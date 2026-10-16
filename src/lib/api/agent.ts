/**
 * Lo que necesita el agente de atención a clientes, que vive fuera (n8n).
 *
 * Desde la v1.66 la plataforma no tiene agentes dentro: cuenta lo que pasa
 * (hooks) y deja escribir (API). Este módulo es solo eso, pero cortado a la
 * medida de un bot que atiende a muchos clientes desde una sola llave:
 *
 *   · **Todo se lee en nombre de un cliente concreto.** El resto de la API lee
 *     como el dueño de la llave, y la llave del agente es del equipo: con ella,
 *     `GET /tickets` devolvería los de todos. Aquí cada consulta lleva el
 *     cliente y se recorta a lo que él vería en la plataforma.
 *   · **El cliente no lo elige quien llama.** `/agent/client` lo reconoce por
 *     su número y entrega un token firmado; el resto solo acepta ese token. Si
 *     aceptara un id o un correo, bastaría con que el cliente le dijera al
 *     modelo «mi correo es otro@…» para leer lo de otro.
 *   · **Solo clientes con el agente en su plan** (`Plan.aiAgent`). El resto
 *     recibe un 403 que el bot traduce a «no está incluido en tu plan».
 *   · **Excepción acordada a la regla de la API:** el agente puede dejar notas
 *     internas. Las firma la cuenta del equipo dueña de la llave, nunca el
 *     cliente, y se exige que el ticket sea del cliente que se atiende.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Priority } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { canOpenModule } from "@/lib/access/can";
import { canAccessTicket } from "@/lib/ticket-access";
import { clientHasPlanFeature } from "@/lib/plans.server";
import { getEffectiveExpiresAt, daysUntilExpiry } from "@/lib/plans";
import { getPlanUsedHours } from "@/lib/time-entries";
import { STATUS_LABELS } from "@/lib/status-labels";
import { normalizePhone } from "@/lib/crm/phone";
import { facturasDeCliente } from "@/lib/billing/portal";
import { checkSite } from "@/lib/infra/site-check";
import { notify, notifyMany } from "@/lib/notify";
import { notifyMentions } from "@/lib/mentions";
import { emitCommentHook } from "@/lib/hooks/dispatch";
import { recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";
import { serializeTicket, ticketSelect } from "@/lib/hooks/payload";
import { ticketScopeWhere, createTicketViaApi, type WriteResult } from "@/lib/api/tickets";
import { addCommentViaApi } from "@/lib/api/comments";
import type { ApiUser } from "@/lib/api/respond";

const APP_URL = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
const DAY = 86_400_000;

export type AgentClient = ApiUser & { companies: { id: string; name: string }[] };

const clientSelect = {
  id: true, name: true, email: true, role: true,
  companies: { where: { isActive: true }, select: { id: true, name: true } },
} as const;

// ─── Identificar al cliente ──────────────────────────────────────────────────

export type ClientLookup =
  | { ok: true; client: AgentClient; agentEnabled: boolean }
  | { ok: false; status: number; error: string; code: "not_found" | "ambiguous" | "invalid" };

/**
 * Quién escribe. Por teléfono —lo que trae WhatsApp— o por id o correo.
 *
 * El teléfono es el que el propio cliente guardó en *Mis integraciones*. No se
 * verifica, y eso es aceptable porque WhatsApp no deja falsear el remitente:
 * quien ponga el número de otro en su cuenta solo consigue que a ese otro le
 * lleguen *sus* datos, no ver los ajenos. Si dos cuentas dicen tener el mismo
 * número no se adivina: se rechaza y se avisa a los administradores, porque
 * mientras tanto el dueño real del número se queda sin agente.
 */
export async function findClient(ref: { id?: string | null; email?: string | null; phone?: string | null }): Promise<ClientLookup> {
  let where;
  let phone: string | null = null;
  if (ref.phone) {
    const digits = ref.phone.replace(/[^\d+]/g, "");
    // WhatsApp lo manda sin «+» (573001234567); el que se guarda es E.164.
    const r = normalizePhone(digits.startsWith("+") ? digits : `+${digits}`);
    if (!r.ok) return { ok: false, status: 400, error: `Teléfono no válido: ${r.error}`, code: "invalid" };
    phone = r.e164;
    where = { whatsappPhone: phone };
  } else if (ref.email) {
    where = { email: ref.email.trim().toLowerCase() };
  } else if (ref.id) {
    where = { id: ref.id.trim() };
  } else {
    return { ok: false, status: 400, error: "Indica phone, email o id del cliente", code: "invalid" };
  }

  const found = await prisma.user.findMany({
    where: { ...where, role: "CLIENTE", isActive: true },
    select: clientSelect,
    take: 2,
  });
  if (found.length === 0) return { ok: false, status: 404, error: "No hay un cliente activo con ese dato", code: "not_found" };
  if (found.length > 1) {
    if (phone) void reportPhoneConflict(phone, found).catch(() => {});
    return { ok: false, status: 409, error: "Varias cuentas de cliente tienen ese número; el equipo debe aclararlo", code: "ambiguous" };
  }

  const client = found[0];
  return { ok: true, client, agentEnabled: await clientHasPlanFeature(client.id, "aiAgent") };
}

/**
 * Avisa a los administradores de un número repetido. El bot vuelve a chocar
 * con cada mensaje del cliente, así que se avisa una vez al día por número.
 */
async function reportPhoneConflict(phone: string, clients: { name: string; email: string }[]) {
  const type = "agent_phone_conflict";
  const already = await prisma.notification.findFirst({
    where: { type, message: { contains: phone }, createdAt: { gte: new Date(Date.now() - DAY) } },
    select: { id: true },
  });
  if (already) return;
  const admins = await prisma.user.findMany({ where: { role: "ADMINISTRADOR", isActive: true }, select: { id: true } });
  await notifyMany(
    admins.map((a) => a.id),
    type,
    "Agente IA: número repetido",
    `El WhatsApp ${phone} está en varias cuentas de cliente (${clients.map((c) => `${c.name} <${c.email}>`).join(", ")}). ` +
      "El agente no atenderá ese número hasta que quede en una sola.",
    "/admin/users",
    // Lleva teléfono y correos de clientes: no va al chat del equipo.
    true,
  );
}

// ─── El token del cliente atendido ───────────────────────────────────────────
//
// `<clientId>.<vence en ms>.<firma>`. La firma incluye la llave que lo pidió:
// un token no sirve con otra llave. Seis horas cubren una conversación y el bot
// pide uno nuevo con cada mensaje, porque cada mensaje pasa por `/agent/client`.

const CLIENT_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;

function tokenSignature(keyId: string, payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está definida: no se pueden firmar tokens del agente");
  return crypto.createHmac("sha256", secret).update(`agent-client:${keyId}:${payload}`).digest("base64url");
}

export function issueClientToken(keyId: string, clientId: string): { token: string; expiresAt: string } {
  const exp = Date.now() + CLIENT_TOKEN_TTL_MS;
  const payload = `${clientId}.${exp}`;
  return { token: `${payload}.${tokenSignature(keyId, payload)}`, expiresAt: new Date(exp).toISOString() };
}

/** El id del cliente si el token es de esta llave y no ha vencido. */
function verifyClientToken(keyId: string, token: string): string | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [clientId, exp, sig] = parts;
  if (!clientId || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  const expected = Buffer.from(tokenSignature(keyId, `${clientId}.${exp}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? clientId : null;
}

/**
 * El cliente de una petición (`client` = el token de `/agent/client`), ya
 * comprobado: activo, cliente y con el agente en su plan. Lo usan todos los
 * endpoints salvo el de identificación, el único que responde aunque el plan
 * no lo incluya.
 */
export async function requireAgentClient(keyId: string, token: string | null | undefined): Promise<WriteResult<AgentClient>> {
  if (!token?.trim()) return { ok: false, status: 400, error: "Falta «client» (el token que devuelve /agent/client)" };
  const clientId = verifyClientToken(keyId, token);
  if (!clientId) {
    return { ok: false, status: 403, error: "«client» no es válido o venció; vuelve a pedirlo a /agent/client (client_token_invalido)" };
  }
  const r = await findClient({ id: clientId });
  if (!r.ok) return { ok: false, status: r.status, error: r.error };
  if (!r.agentEnabled) {
    return { ok: false, status: 403, error: "El plan de este cliente no incluye el agente IA (plan_sin_agente)" };
  }
  return { ok: true, value: r.client };
}

const companyIdsOf = (c: AgentClient) => c.companies.map((x) => x.id);

// ─── Contexto ────────────────────────────────────────────────────────────────

function expiryState(due: Date | null, now = Date.now()): "vencido" | "por_vencer" | "vigente" | "sin_fecha" {
  if (!due) return "sin_fecha";
  if (due.getTime() < now) return "vencido";
  return due.getTime() - now <= 30 * DAY ? "por_vencer" : "vigente";
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function plansOf(client: AgentClient) {
  const plans = await prisma.plan.findMany({
    where: { companyId: { in: companyIdsOf(client) }, isActive: true },
    select: {
      id: true, name: true, type: true, totalHours: true, durationDays: true, startedAt: true, expiresAt: true,
      isActive: true, prioritySupport: true, company: { select: { name: true } },
    },
    orderBy: { startedAt: "desc" },
  });
  return Promise.all(
    plans.map(async (p) => {
      const expiresAt = getEffectiveExpiresAt(p);
      const used = p.type === "BOLSA_HORAS" ? await getPlanUsedHours(p.id) : null;
      const remaining = p.totalHours !== null && used !== null ? Math.max(p.totalHours - used, 0) : null;
      const vencido = expiresAt !== null && expiresAt.getTime() < Date.now();
      const agotado = remaining !== null && remaining <= 0;
      return {
        id: p.id,
        name: p.name,
        company: p.company.name,
        type: p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual",
        startedAt: iso(p.startedAt),
        expiresAt: iso(expiresAt),
        daysLeft: daysUntilExpiry(p),
        totalHours: p.totalHours,
        usedHours: used !== null ? Math.round(used * 100) / 100 : null,
        remainingHours: remaining !== null ? Math.round(remaining * 100) / 100 : null,
        status: vencido ? "vencido" : agotado ? "horas_agotadas" : "vigente",
        prioritySupport: p.prioritySupport,
      };
    }),
  );
}

function ticketLine(t: ReturnType<typeof serializeTicket>) {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    status: t.status,
    statusLabel: STATUS_LABELS[t.status] ?? t.status,
    priority: t.priority,
    assignedTo: t.assignedTo?.name ?? null,
    dueDate: t.dueDate,
    updatedAt: t.updatedAt,
    site: t.site,
    url: t.url,
  };
}

async function ticketsOf(client: AgentClient) {
  const scope = await ticketScopeWhere(client);
  const since = new Date(Date.now() - 30 * DAY);
  const [open, closed] = await Promise.all([
    prisma.ticket.findMany({
      where: { AND: [scope, { status: { not: "CERRADO" } }] },
      select: ticketSelect, orderBy: { updatedAt: "desc" }, take: 30,
    }),
    prisma.ticket.findMany({
      where: { AND: [scope, { status: "CERRADO", updatedAt: { gte: since } }] },
      select: ticketSelect, orderBy: { updatedAt: "desc" }, take: 10,
    }),
  ]);
  return {
    open: open.map((t) => ticketLine(serializeTicket(t))),
    recentlyClosed: closed.map((t) => ticketLine(serializeTicket(t))),
  };
}

/** Misma frontera que la ficha del proyecto (`canClientAccessProject`), como filtro. */
async function projectsOf(client: AgentClient) {
  const projects = await prisma.project.findMany({
    where: {
      isDraft: false,
      isActive: true,
      OR: [
        { isPrivate: false, companyId: { in: companyIdsOf(client) } },
        { isPrivate: true, members: { some: { userId: client.id } } },
      ],
    },
    select: {
      id: true, name: true, startDate: true, dueDate: true,
      company: { select: { name: true } },
      manager: { select: { name: true } },
      tasks: { where: { isDraft: false }, select: { status: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  return projects.map((p) => {
    const total = p.tasks.length;
    const done = p.tasks.filter((t) => t.status === "COMPLETADO").length;
    return {
      id: p.id,
      name: p.name,
      company: p.company?.name ?? null,
      manager: p.manager?.name ?? null,
      startDate: iso(p.startDate),
      dueDate: iso(p.dueDate),
      tasks: {
        total,
        completed: done,
        inProgress: p.tasks.filter((t) => t.status === "EN_PROGRESO").length,
        inReview: p.tasks.filter((t) => t.status === "EN_REVISION").length,
        pending: p.tasks.filter((t) => t.status === "PENDIENTE").length,
      },
      progress: total > 0 ? Math.round((done / total) * 100) : null,
      url: `${APP_URL}/proyectos/${p.id}`,
    };
  });
}

async function servicesOf(companyIds: string[]) {
  const services = await prisma.service.findMany({
    where: { companyId: { in: companyIds }, isActive: true },
    select: { id: true, name: true, type: true, provider: true, dueDate: true, company: { select: { name: true } } },
    orderBy: [{ type: "asc" }, { dueDate: "asc" }],
  });
  return services.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    provider: s.provider,
    company: s.company.name,
    dueDate: iso(s.dueDate),
    state: expiryState(s.dueDate),
  }));
}

async function billingOf(client: AgentClient) {
  // «Mi facturación» la autoriza un administrador cliente por cliente: el bot
  // no puede ser una puerta trasera a lo que la plataforma no le enseña.
  if (!(await canOpenModule(client, "PORTAL_FACTURACION"))) {
    return { available: false as const, reason: "Este cliente no tiene autorizado ver su facturación." };
  }
  const facturas = await facturasDeCliente(client.id);
  const pendientes = facturas.filter((f) => f.estado !== "PAGADA");
  return {
    available: true as const,
    totalPending: pendientes.reduce((s, f) => s + f.falta, 0),
    currency: "COP",
    pending: pendientes.map((f) => ({
      id: f.id,
      concept: f.concept,
      company: f.company,
      invoiceNumber: f.invoiceNumber,
      invoiceDueDate: iso(f.invoiceDueDate),
      overdue: f.vencida,
      total: f.total,
      paid: f.pagado,
      remaining: f.falta,
      payUrl: f.linkPago,
    })),
    lastPaid: facturas
      .filter((f) => f.estado === "PAGADA")
      .slice(0, 3)
      .map((f) => ({ concept: f.concept, invoiceNumber: f.invoiceNumber, total: f.total, paidAt: iso(f.paidAt) })),
  };
}

/** Todo lo del cliente en una llamada: es lo que el agente carga al empezar a atender. */
export async function agentContext(client: AgentClient) {
  const [plans, tickets, projects, services, sites, billing] = await Promise.all([
    plansOf(client),
    ticketsOf(client),
    projectsOf(client),
    servicesOf(companyIdsOf(client)),
    prisma.site.findMany({
      where: { companyId: { in: companyIdsOf(client) }, isActive: true },
      select: { id: true, name: true, domain: true, company: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    billingOf(client),
  ]);
  return {
    client: { id: client.id, name: client.name, email: client.email, companies: client.companies },
    generatedAt: new Date().toISOString(),
    plans,
    tickets,
    projects,
    services,
    sites: sites.map((s) => ({ id: s.id, name: s.name, domain: s.domain, company: s.company.name })),
    billing,
  };
}

// ─── Un ticket ───────────────────────────────────────────────────────────────

/** Por id o por código («ACM-12»), y solo si el cliente lo ve en la plataforma. */
export async function resolveClientTicket(client: AgentClient, idOrCode: string): Promise<string | null> {
  const ref = idOrCode.trim();
  let id: string | null = ref;
  const code = /^([A-Za-z0-9]+)-(\d+)$/.exec(ref);
  if (code) {
    // El código no es único entre empresas: se busca solo entre los del cliente.
    const t = await prisma.ticket.findFirst({
      where: { AND: [await ticketScopeWhere(client), { prefix: code[1].toUpperCase(), number: Number(code[2]) }] },
      select: { id: true },
    });
    id = t?.id ?? null;
  }
  if (!id) return null;
  return (await canAccessTicket(id, client.id, client.role)) ? id : null;
}

export async function agentTicket(client: AgentClient, idOrCode: string) {
  const id = await resolveClientTicket(client, idOrCode);
  if (!id) return null;
  const [row, comments] = await Promise.all([
    prisma.ticket.findUnique({ where: { id }, select: ticketSelect }),
    prisma.comment.findMany({
      // Solo lo que el cliente ve en el hilo.
      where: { entityType: "TICKET", entityId: id, isInternal: false },
      select: { body: true, createdAt: true, author: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  if (!row) return null;
  const t = serializeTicket(row);
  return {
    ...ticketLine(t),
    description: t.description,
    createdAt: t.createdAt,
    comments: comments.reverse().map((c) => ({
      author: c.author.name,
      fromTeam: isStaff(c.author.role),
      body: c.body.length > 1500 ? `${c.body.slice(0, 1500)}…` : c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

// ─── Diagnóstico de un sitio ─────────────────────────────────────────────────

/**
 * La documentación y la arquitectura de la ficha no salen: son del equipo, a
 * veces traen accesos y el agente conversa con el cliente. Taparlas con un
 * filtro no basta —`DB_PASSWORD=…`, una URL con usuario y clave o una tabla
 * pasan—, y lo útil para el cliente ya está en las comprobaciones.
 */
export async function agentSiteDiagnosis(client: AgentClient, siteId: string) {
  const site = await prisma.site.findFirst({
    where: { id: siteId, companyId: { in: companyIdsOf(client) }, isActive: true },
    select: { id: true, name: true, domain: true, companyId: true },
  });
  if (!site) return null;

  const [check, services, openTickets] = await Promise.all([
    checkSite(site.domain),
    servicesOf([site.companyId]),
    prisma.ticket.findMany({
      where: { AND: [await ticketScopeWhere(client), { siteId: site.id, status: { not: "CERRADO" } }] },
      select: ticketSelect,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  // Los servicios de la empresa que sostienen un sitio. La ficha del servicio
  // no dice a qué sitio pertenece, así que se dan todos los de ese tipo.
  const relevant = services.filter((s) => ["DOMINIO", "HOSTING", "SSL"].includes(s.type));
  const findings = [...check.findings];
  for (const s of relevant.filter((x) => x.state === "vencido")) {
    findings.unshift(`El servicio «${s.name}» (${s.type.toLowerCase()}) figura vencido desde ${s.dueDate?.slice(0, 10)}: puede ser la causa.`);
  }
  if (openTickets.length > 0) {
    findings.push(`Ya hay ${openTickets.length} ticket(s) abierto(s) sobre este sitio; conviene revisarlos antes de abrir otro.`);
  }

  return {
    site: { id: site.id, name: site.name, domain: site.domain },
    check,
    services: relevant,
    openTickets: openTickets.map((t) => ticketLine(serializeTicket(t))),
    findings,
    looksHealthy: findings.length === 0,
  };
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export async function agentCreateTicket(
  client: AgentClient,
  keyLabel: string,
  input: { title: string; description: string; priority?: Priority; siteId?: string | null; category?: string | null },
) {
  if (input.siteId) {
    const site = await prisma.site.findFirst({
      where: { id: input.siteId, companyId: { in: companyIdsOf(client) }, isActive: true },
      select: { id: true },
    });
    if (!site) return { ok: false as const, status: 404, error: "Ese sitio no es de este cliente" };
  }
  // A nombre del cliente y contra su plan, como si lo abriera él: mismo prefijo,
  // mismo freno sin plan vigente, mismos avisos al equipo.
  return createTicketViaApi(client, `${keyLabel} · agente IA`, {
    title: input.title,
    description: input.description,
    priority: input.priority,
    siteId: input.siteId ?? null,
    category: input.category ?? null,
  });
}

/**
 * Comenta un ticket del cliente. Firma siempre la cuenta del equipo dueña de
 * la llave: el cliente no escribió ese texto, lo redactó el agente.
 *
 *   · Público → lo ve todo el hilo, incluido el cliente, con los avisos de siempre.
 *   · Interno → solo el equipo. Como nadie del equipo está mirando la
 *     conversación, se avisa al responsable del ticket.
 */
export async function agentComment(
  agent: ApiUser,
  client: AgentClient,
  idOrCode: string,
  body: string,
  internal: boolean,
) {
  const ticketId = await resolveClientTicket(client, idOrCode);
  if (!ticketId) return { ok: false as const, status: 404, error: "No encuentro ese ticket entre los del cliente" };

  if (!internal) return addCommentViaApi(agent, "TICKET", ticketId, body);

  const created = await prisma.comment.create({
    data: { entityType: "TICKET", entityId: ticketId, authorId: agent.id, isInternal: true, body: body.trim() },
    select: { id: true, body: true, isInternal: true, createdAt: true },
  });

  emitCommentHook(created.id, { actor: { id: agent.id, name: agent.name } });
  recordActivity({
    entityType: "TICKET",
    entityId: ticketId,
    action: "comment.created",
    label: await entityLabel("TICKET", ticketId),
    meta: { note: "Nota interna del agente IA." },
    actor: { id: agent.id, name: agent.name },
  });
  await notifyMentions({ author: agent, entityType: "TICKET", entityId: ticketId, body: created.body });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true, assignedToId: true } });
  if (ticket?.assignedToId && ticket.assignedToId !== agent.id) {
    await notify(
      ticket.assignedToId,
      "ticket_comment",
      "Nota interna del agente IA",
      `${client.name} habló con el agente sobre: "${ticket.title}"`,
      `/tickets/${ticketId}`,
      true,
    );
  }

  return {
    ok: true as const,
    value: { id: created.id, body: created.body, isInternal: true, createdAt: created.createdAt.toISOString() },
  };
}
