/**
 * La forma de los datos que viajan en un hook.
 *
 * Es un contrato público: quien monta un workflow en n8n escribe expresiones
 * contra estos campos, así que cambiarles el nombre rompe integraciones ajenas.
 * Añadir campos es seguro; quitarlos o renombrarlos, no.
 *
 * Las mismas funciones sirven a la API de entrada (`/api/v1`), para que un
 * ticket se lea igual venga por hook o por GET. Un solo formato que aprender.
 */

import { prisma } from "@/lib/prisma";
import { ticketCode } from "@/lib/ticket-code";
import { taskCode } from "@/lib/task-code";
import { fullName } from "@/lib/crm/contact-name";

export const APP_URL = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

type PersonRow = { id: string; name: string; email: string } | null | undefined;

function person(user: PersonRow) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

const ticketSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  isDraft: true,
  prefix: true,
  number: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  client: { select: { id: true, name: true, email: true } },
  plan: { select: { id: true, name: true } },
  site: { select: { id: true, name: true, domain: true } },
} as const;

type TicketRow = NonNullable<Awaited<ReturnType<typeof loadTicketRow>>>;

function loadTicketRow(id: string) {
  return prisma.ticket.findUnique({ where: { id }, select: ticketSelect });
}

export function serializeTicket(ticket: TicketRow) {
  return {
    id: ticket.id,
    code: ticketCode(ticket.prefix, ticket.number),
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category,
    isDraft: ticket.isDraft,
    dueDate: iso(ticket.dueDate),
    createdAt: iso(ticket.createdAt),
    updatedAt: iso(ticket.updatedAt),
    url: `${APP_URL}/tickets/${ticket.id}`,
    createdBy: person(ticket.createdBy),
    assignedTo: person(ticket.assignedTo),
    client: person(ticket.client),
    plan: ticket.plan ? { id: ticket.plan.id, name: ticket.plan.name } : null,
    site: ticket.site ? { id: ticket.site.id, name: ticket.site.name, domain: ticket.site.domain } : null,
  };
}

export async function ticketPayload(id: string) {
  const row = await loadTicketRow(id);
  return row ? serializeTicket(row) : null;
}

export { ticketSelect };

// ─── Tareas ──────────────────────────────────────────────────────────────────

const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  category: true,
  isDraft: true,
  number: true,
  externalRef: true,
  startDate: true,
  startTime: true,
  dueDate: true,
  endTime: true,
  estimatedHours: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, isPrivate: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} as const;

type TaskRow = NonNullable<Awaited<ReturnType<typeof loadTaskRow>>>;

function loadTaskRow(id: string) {
  return prisma.task.findUnique({ where: { id }, select: taskSelect });
}

export function serializeTask(task: TaskRow) {
  const url = task.project
    ? `${APP_URL}/proyectos/${task.project.id}/tareas/${task.id}`
    : `${APP_URL}/tareas/${task.id}`;

  return {
    id: task.id,
    code: task.project ? taskCode(task.project.name, task.number) : null,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category,
    isDraft: task.isDraft,
    externalRef: task.externalRef,
    startDate: iso(task.startDate),
    startTime: task.startTime,
    dueDate: iso(task.dueDate),
    endTime: task.endTime,
    estimatedHours: task.estimatedHours,
    createdAt: iso(task.createdAt),
    updatedAt: iso(task.updatedAt),
    url,
    project: task.project ? { id: task.project.id, name: task.project.name } : null,
    createdBy: person(task.createdBy),
    assignedTo: person(task.assignedTo),
  };
}

export async function taskPayload(id: string) {
  const row = await loadTaskRow(id);
  return row ? serializeTask(row) : null;
}

export { taskSelect };

// ─── Proyectos ───────────────────────────────────────────────────────────────

const projectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  isActive: true,
  isPrivate: true,
  startDate: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true } },
  manager: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

type ProjectRow = NonNullable<Awaited<ReturnType<typeof loadProjectRow>>>;

function loadProjectRow(id: string) {
  return prisma.project.findUnique({ where: { id }, select: projectSelect });
}

export function serializeProject(project: ProjectRow) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    isActive: project.isActive,
    isPrivate: project.isPrivate,
    startDate: iso(project.startDate),
    dueDate: iso(project.dueDate),
    createdAt: iso(project.createdAt),
    updatedAt: iso(project.updatedAt),
    url: `${APP_URL}/proyectos/${project.id}`,
    company: project.company ? { id: project.company.id, name: project.company.name } : null,
    manager: person(project.manager),
    createdBy: person(project.createdBy),
  };
}

export async function projectPayload(id: string) {
  const row = await loadProjectRow(id);
  return row ? serializeProject(row) : null;
}

export { projectSelect };

// ─── CRM · Cuentas ───────────────────────────────────────────────────────────

const accountSelect = {
  id: true,
  name: true,
  stage: true,
  source: true,
  taxId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { contacts: true, deals: true } },
} as const;

type AccountRow = NonNullable<Awaited<ReturnType<typeof loadAccountRow>>>;

function loadAccountRow(id: string) {
  return prisma.company.findUnique({ where: { id }, select: accountSelect });
}

export function serializeAccount(account: AccountRow) {
  return {
    id: account.id,
    name: account.name,
    stage: account.stage,
    source: account.source,
    taxId: account.taxId,
    isActive: account.isActive,
    createdAt: iso(account.createdAt),
    updatedAt: iso(account.updatedAt),
    url: `${APP_URL}/crm/${account.id}`,
    owner: person(account.owner),
    contactCount: account._count.contacts,
    dealCount: account._count.deals,
  };
}

export async function accountPayload(id: string) {
  const row = await loadAccountRow(id);
  return row ? serializeAccount(row) : null;
}

export { accountSelect };

// ─── CRM · Contactos ─────────────────────────────────────────────────────────

const contactSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  position: true,
  isPrimary: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, stage: true } },
} as const;

type ContactRow = NonNullable<Awaited<ReturnType<typeof loadContactRow>>>;

function loadContactRow(id: string) {
  return prisma.contact.findUnique({ where: { id }, select: contactSelect });
}

export function serializeContact(contact: ContactRow) {
  return {
    id: contact.id,
    // `name` se mantiene aunque en la base ya no exista: es un contrato público
    // y quitarlo rompería los workflows que ya lo leen. Ahora se compone.
    name: fullName(contact),
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    position: contact.position,
    isPrimary: contact.isPrimary,
    isActive: contact.isActive,
    createdAt: iso(contact.createdAt),
    updatedAt: iso(contact.updatedAt),
    url: `${APP_URL}/crm/${contact.company.id}`,
    account: { id: contact.company.id, name: contact.company.name, stage: contact.company.stage },
  };
}

export async function contactPayload(id: string) {
  const row = await loadContactRow(id);
  return row ? serializeContact(row) : null;
}

export { contactSelect };

// ─── CRM · Oportunidades ─────────────────────────────────────────────────────

const dealSelect = {
  id: true,
  title: true,
  stage: true,
  amount: true,
  notes: true,
  expectedCloseAt: true,
  closedAt: true,
  lostReason: true,
  createdAt: true,
  updatedAt: true,
  company: { select: { id: true, name: true, stage: true } },
  owner: { select: { id: true, name: true, email: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

type DealRow = NonNullable<Awaited<ReturnType<typeof loadDealRow>>>;

function loadDealRow(id: string) {
  return prisma.deal.findUnique({ where: { id }, select: dealSelect });
}

export function serializeDeal(deal: DealRow) {
  return {
    id: deal.id,
    title: deal.title,
    stage: deal.stage,
    amount: deal.amount,
    notes: deal.notes,
    expectedCloseAt: iso(deal.expectedCloseAt),
    closedAt: iso(deal.closedAt),
    lostReason: deal.lostReason,
    // Un consumidor no debería tener que saberse qué etapas son terminales para
    // decidir si actuar: se lo decimos.
    isOpen: deal.closedAt === null,
    createdAt: iso(deal.createdAt),
    updatedAt: iso(deal.updatedAt),
    url: `${APP_URL}/crm/oportunidades/${deal.id}`,
    account: { id: deal.company.id, name: deal.company.name, stage: deal.company.stage },
    owner: person(deal.owner),
    contact: deal.contact ? { id: deal.contact.id, name: fullName(deal.contact), email: deal.contact.email } : null,
    createdBy: person(deal.createdBy),
  };
}

export async function dealPayload(id: string) {
  const row = await loadDealRow(id);
  return row ? serializeDeal(row) : null;
}

export { dealSelect };

// ─── CRM · Actividad ─────────────────────────────────────────────────────────

const activitySelect = {
  id: true,
  type: true,
  summary: true,
  notes: true,
  occurredAt: true,
  createdAt: true,
  company: { select: { id: true, name: true, stage: true } },
  deal: { select: { id: true, title: true, stage: true } },
  contact: { select: { id: true, firstName: true, lastName: true, email: true } },
  createdBy: { select: { id: true, name: true, email: true } },
} as const;

type ActivityRow = NonNullable<Awaited<ReturnType<typeof loadActivityRow>>>;

function loadActivityRow(id: string) {
  return prisma.crmActivity.findUnique({ where: { id }, select: activitySelect });
}

export function serializeActivity(activity: ActivityRow) {
  return {
    id: activity.id,
    type: activity.type,
    summary: activity.summary,
    notes: activity.notes,
    occurredAt: iso(activity.occurredAt),
    createdAt: iso(activity.createdAt),
    url: `${APP_URL}/crm/${activity.company.id}`,
    account: { id: activity.company.id, name: activity.company.name, stage: activity.company.stage },
    deal: activity.deal ? { id: activity.deal.id, title: activity.deal.title, stage: activity.deal.stage } : null,
    contact: activity.contact ? { id: activity.contact.id, name: fullName(activity.contact), email: activity.contact.email } : null,
    createdBy: person(activity.createdBy),
  };
}

export async function activityPayload(id: string) {
  const row = await loadActivityRow(id);
  return row ? serializeActivity(row) : null;
}

export { activitySelect };

// ─── Comentarios ─────────────────────────────────────────────────────────────

const commentSelect = {
  id: true,
  entityType: true,
  entityId: true,
  body: true,
  isInternal: true,
  createdAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

type CommentRow = NonNullable<Awaited<ReturnType<typeof loadCommentRow>>>;

function loadCommentRow(id: string) {
  return prisma.comment.findUnique({ where: { id }, select: commentSelect });
}

export function serializeComment(
  comment: CommentRow,
  entity: { title: string; url: string; projectId?: string | null } | null,
) {
  return {
    id: comment.id,
    body: comment.body,
    isInternal: comment.isInternal,
    createdAt: iso(comment.createdAt),
    author: person(comment.author),
    entity: {
      type: comment.entityType,
      id: comment.entityId,
      title: entity?.title ?? null,
      url: entity?.url ?? null,
    },
  };
}

/**
 * Comentario con el mínimo contexto de la entidad comentada.
 *
 * Sin título ni enlace, un comentario suelto no le sirve a nadie del otro lado:
 * el consumidor tendría que hacer otra llamada solo para saber dónde ocurrió.
 */
export async function commentPayload(id: string) {
  const comment = await loadCommentRow(id);
  if (!comment) return null;

  let entity: { title: string; url: string; projectId?: string | null } | null = null;

  if (comment.entityType === "TICKET") {
    const ticket = await prisma.ticket.findUnique({
      where: { id: comment.entityId },
      select: { title: true },
    });
    if (ticket) entity = { title: ticket.title, url: `${APP_URL}/tickets/${comment.entityId}` };
  } else if (comment.entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: comment.entityId },
      select: { title: true, projectId: true },
    });
    if (task) {
      entity = {
        title: task.title,
        url: task.projectId
          ? `${APP_URL}/proyectos/${task.projectId}/tareas/${comment.entityId}`
          : `${APP_URL}/tareas/${comment.entityId}`,
        projectId: task.projectId,
      };
    }
  } else if (comment.entityType === "PROJECT") {
    const project = await prisma.project.findUnique({
      where: { id: comment.entityId },
      select: { name: true },
    });
    if (project) {
      entity = {
        title: project.name,
        url: `${APP_URL}/proyectos/${comment.entityId}`,
        projectId: comment.entityId,
      };
    }
  }

  return { payload: serializeComment(comment, entity), projectId: entity?.projectId ?? null };
}
