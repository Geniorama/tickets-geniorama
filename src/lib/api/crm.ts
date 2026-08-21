/**
 * El CRM desde la API pública.
 *
 * Igual que en tickets y tareas, no se reutilizan las Server Actions: aquellas
 * empiezan con `getRequiredSession()` y acaban en `redirect()`, y aquí del otro
 * lado solo hay una llave.
 *
 * Lo que sí se respeta es la frontera del módulo. Una llave no es un permiso
 * aparte: hereda lo que su dueño puede hacer en el CRM, resuelto con el mismo
 * `can()` que usan las pantallas. Si a alguien se le retira el módulo, sus
 * llaves dejan de leer el CRM en la siguiente petición — sin revocarlas ni
 * tocar nada. Y como el rol es el techo, una llave de cliente nunca entra,
 * tenga los permisos que tenga.
 */

import { prisma } from "@/lib/prisma";
import type { AccountStage, ActivityType, DealStage, Prisma } from "@/generated/prisma";
import { can, type Capability } from "@/lib/access/can";
import { isClosedStage } from "@/lib/crm/deals";
import {
  accountSelect, activitySelect, contactSelect, dealSelect,
  serializeAccount, serializeActivity, serializeContact, serializeDeal,
} from "@/lib/hooks/payload";
import {
  emitAccountHook, emitActivityHook, emitContactHook,
  emitDealHook, emitDealStageHooks,
} from "@/lib/hooks/dispatch";
import type { ApiUser } from "@/lib/api/respond";
import type { WriteResult } from "@/lib/api/tickets";

export type CrmDenied = { status: number; error: string };

/**
 * El guardia va dentro de cada función y no en las rutas: así una ruta nueva no
 * puede olvidarse de comprobarlo. Las de lectura devuelven el rechazo mezclado
 * con su resultado, y `isDenied` lo separa de un vistazo.
 */
export async function requireCrm(
  user: ApiUser,
  capability: Capability,
): Promise<CrmDenied | null> {
  if (await can(user, "CRM", capability)) return null;
  return {
    status: 403,
    error: `El usuario dueño de la llave no tiene permiso para ${capability} en el CRM`,
  };
}

export function isDenied(value: unknown): value is CrmDenied {
  return typeof value === "object" && value !== null && "status" in value && "error" in value;
}

const actorOf = (user: ApiUser) => ({ id: user.id, name: user.name });

// ─── Cuentas ─────────────────────────────────────────────────────────────────

export async function listAccounts(
  user: ApiUser,
  opts: { limit: number; cursor: string | null; stage?: string; search?: string },
) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const where: Prisma.CompanyWhereInput = {
    ...(opts.stage ? { stage: opts.stage as AccountStage } : {}),
    ...(opts.search ? { name: { contains: opts.search, mode: "insensitive" as const } } : {}),
  };

  const rows = await prisma.company.findMany({
    where,
    select: accountSelect,
    orderBy: { name: "asc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    accounts: page.map(serializeAccount),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getAccount(user: ApiUser, accountId: string) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const row = await prisma.company.findUnique({ where: { id: accountId }, select: accountSelect });
  return row ? { account: serializeAccount(row) } : null;
}

export type CreateAccountInput = {
  name: string;
  stage?: AccountStage;
  taxId?: string | null;
  source?: string | null;
  ownerId?: string | null;
};

export async function createAccountViaApi(
  user: ApiUser,
  input: CreateAccountInput,
): Promise<WriteResult<ReturnType<typeof serializeAccount>>> {
  const denied = await requireCrm(user, "crear");
  if (denied) return { ok: false, ...denied };

  if (input.ownerId) {
    const owner = await prisma.user.findFirst({
      where: { id: input.ownerId, isActive: true, role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
      select: { id: true },
    });
    if (!owner) {
      return { ok: false, status: 404, error: "El responsable no existe, está inactivo o no es del equipo." };
    }
  }

  // Un lead que entra por un formulario web suele llegar repetido. Devolver la
  // cuenta que ya existe es más útil que crear un duplicado o fallar: el
  // workflow del otro lado puede seguir sin ramificar.
  const existente = await prisma.company.findFirst({
    where: { name: { equals: input.name.trim(), mode: "insensitive" } },
    select: accountSelect,
  });
  if (existente) return { ok: true, value: serializeAccount(existente) };

  const created = await prisma.company.create({
    data: {
      name: input.name.trim().slice(0, 160),
      // Lo que entra por integración es un lead salvo que se diga otra cosa:
      // nadie conecta un formulario web para registrar clientes ya cerrados.
      stage: input.stage ?? "LEAD",
      taxId: input.taxId?.trim() || null,
      source: input.source?.trim() || null,
      ownerId: input.ownerId || null,
    },
    select: accountSelect,
  });

  emitAccountHook("account.created", created.id, { actor: actorOf(user) });

  return { ok: true, value: serializeAccount(created) };
}

export type UpdateAccountInput = {
  name?: string;
  stage?: AccountStage;
  taxId?: string | null;
  source?: string | null;
  ownerId?: string | null;
};

export async function updateAccountViaApi(
  user: ApiUser,
  accountId: string,
  input: UpdateAccountInput,
): Promise<WriteResult<ReturnType<typeof serializeAccount>>> {
  const denied = await requireCrm(user, "editar");
  if (denied) return { ok: false, ...denied };

  const before = await prisma.company.findUnique({
    where: { id: accountId },
    select: { stage: true },
  });
  if (!before) return { ok: false, status: 404, error: "Cuenta no encontrada" };

  const updated = await prisma.company.update({
    where: { id: accountId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim().slice(0, 160) } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.taxId !== undefined ? { taxId: input.taxId?.trim() || null } : {}),
      ...(input.source !== undefined ? { source: input.source?.trim() || null } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
    },
    select: accountSelect,
  });

  emitAccountHook("account.updated", accountId, { actor: actorOf(user) });
  if (input.stage !== undefined && input.stage !== before.stage) {
    emitAccountHook("account.stage_changed", accountId, {
      actor: actorOf(user),
      changes: { stage: { from: before.stage, to: input.stage } },
    });
  }

  return { ok: true, value: serializeAccount(updated) };
}

// ─── Contactos ───────────────────────────────────────────────────────────────

export async function listContacts(user: ApiUser, accountId: string) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const account = await prisma.company.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) return null;

  const rows = await prisma.contact.findMany({
    where: { companyId: accountId, isActive: true },
    select: contactSelect,
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });

  return { contacts: rows.map(serializeContact) };
}

export type CreateContactInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
};

export async function createContactViaApi(
  user: ApiUser,
  accountId: string,
  input: CreateContactInput,
): Promise<WriteResult<ReturnType<typeof serializeContact>>> {
  const denied = await requireCrm(user, "crear");
  if (denied) return { ok: false, ...denied };

  const account = await prisma.company.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) return { ok: false, status: 404, error: "Cuenta no encontrada" };

  const created = await prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.contact.updateMany({ where: { companyId: accountId }, data: { isPrimary: false } });
    }
    return tx.contact.create({
      data: {
        companyId: accountId,
        name: input.name.trim().slice(0, 160),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        position: input.position?.trim() || null,
        notes: input.notes?.trim() || null,
        isPrimary: input.isPrimary ?? false,
        createdById: user.id,
      },
      select: contactSelect,
    });
  });

  emitContactHook("contact.created", created.id, { actor: actorOf(user) });

  return { ok: true, value: serializeContact(created) };
}

// ─── Oportunidades ───────────────────────────────────────────────────────────

export async function listDeals(
  user: ApiUser,
  opts: { limit: number; cursor: string | null; stage?: string; accountId?: string; open?: boolean },
) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const where: Prisma.DealWhereInput = {
    ...(opts.stage ? { stage: opts.stage as DealStage } : {}),
    ...(opts.accountId ? { companyId: opts.accountId } : {}),
    // «Abiertas» se resuelve por `closedAt` y no por la lista de etapas: es el
    // mismo campo que sella el cierre, así que no pueden discrepar.
    ...(opts.open === true ? { closedAt: null } : {}),
    ...(opts.open === false ? { closedAt: { not: null } } : {}),
  };

  const rows = await prisma.deal.findMany({
    where,
    select: dealSelect,
    orderBy: { createdAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    deals: page.map(serializeDeal),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export async function getDeal(user: ApiUser, dealId: string) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const row = await prisma.deal.findUnique({ where: { id: dealId }, select: dealSelect });
  return row ? { deal: serializeDeal(row) } : null;
}

export type CreateDealInput = {
  title: string;
  accountId: string;
  stage?: DealStage;
  amount?: number | null;
  expectedCloseAt?: Date | null;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
};

/** El contacto tiene que ser de la cuenta; si no, se ataría gente de otra empresa. */
async function contactBelongsTo(contactId: string | null | undefined, companyId: string) {
  if (!contactId) return true;
  return (await prisma.contact.count({ where: { id: contactId, companyId } })) > 0;
}

export async function createDealViaApi(
  user: ApiUser,
  input: CreateDealInput,
): Promise<WriteResult<ReturnType<typeof serializeDeal>>> {
  const denied = await requireCrm(user, "crear");
  if (denied) return { ok: false, ...denied };

  const account = await prisma.company.findUnique({ where: { id: input.accountId }, select: { id: true } });
  if (!account) return { ok: false, status: 404, error: "Cuenta no encontrada" };

  if (!(await contactBelongsTo(input.contactId, input.accountId))) {
    return { ok: false, status: 400, error: "El contacto no pertenece a esta cuenta." };
  }

  const stage = input.stage ?? "NUEVA";

  const created = await prisma.deal.create({
    data: {
      title: input.title.trim().slice(0, 160),
      companyId: input.accountId,
      stage,
      amount: input.amount ?? null,
      expectedCloseAt: input.expectedCloseAt ?? null,
      closedAt: isClosedStage(stage) ? new Date() : null,
      contactId: input.contactId || null,
      ownerId: input.ownerId || null,
      notes: input.notes?.trim() || null,
      createdById: user.id,
    },
    select: dealSelect,
  });

  emitDealHook("deal.created", created.id, { actor: actorOf(user) });
  if (isClosedStage(stage)) {
    emitDealStageHooks(created.id, "NUEVA", stage, { actor: actorOf(user) });
  }

  return { ok: true, value: serializeDeal(created) };
}

export type UpdateDealInput = {
  title?: string;
  stage?: DealStage;
  amount?: number | null;
  expectedCloseAt?: Date | null;
  contactId?: string | null;
  ownerId?: string | null;
  notes?: string | null;
  lostReason?: string | null;
};

export async function updateDealViaApi(
  user: ApiUser,
  dealId: string,
  input: UpdateDealInput,
): Promise<WriteResult<ReturnType<typeof serializeDeal>>> {
  const denied = await requireCrm(user, "editar");
  if (denied) return { ok: false, ...denied };

  const before = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { stage: true, closedAt: true, companyId: true },
  });
  if (!before) return { ok: false, status: 404, error: "Oportunidad no encontrada" };

  if (input.contactId !== undefined && !(await contactBelongsTo(input.contactId, before.companyId))) {
    return { ok: false, status: 400, error: "El contacto no pertenece a esta cuenta." };
  }

  const stage = input.stage ?? before.stage;
  const cerrando = isClosedStage(stage);

  const updated = await prisma.deal.update({
    where: { id: dealId },
    data: {
      ...(input.title !== undefined ? { title: input.title.trim().slice(0, 160) } : {}),
      ...(input.stage !== undefined ? { stage: input.stage } : {}),
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.expectedCloseAt !== undefined ? { expectedCloseAt: input.expectedCloseAt } : {}),
      ...(input.contactId !== undefined ? { contactId: input.contactId || null } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      // Cerrar sella la fecha; reabrir la borra. Mismo criterio que el tablero,
      // para que mover por API y arrastrar en la interfaz dejen lo mismo.
      ...(input.stage !== undefined
        ? {
            closedAt: cerrando ? (before.closedAt ?? new Date()) : null,
            lostReason: stage === "PERDIDA" ? (input.lostReason?.trim() || null) : null,
          }
        : {}),
    },
    select: dealSelect,
  });

  emitDealHook("deal.updated", dealId, { actor: actorOf(user) });
  if (input.stage !== undefined) {
    emitDealStageHooks(dealId, before.stage, stage, { actor: actorOf(user) });
  }

  return { ok: true, value: serializeDeal(updated) };
}

// ─── Actividad ───────────────────────────────────────────────────────────────

export async function listActivities(
  user: ApiUser,
  opts: { limit: number; cursor: string | null; accountId?: string; dealId?: string },
) {
  const denied = await requireCrm(user, "ver");
  if (denied) return denied;

  const rows = await prisma.crmActivity.findMany({
    where: {
      ...(opts.accountId ? { companyId: opts.accountId } : {}),
      ...(opts.dealId ? { dealId: opts.dealId } : {}),
    },
    select: activitySelect,
    orderBy: { occurredAt: "desc" },
    take: opts.limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > opts.limit;
  const page = hasMore ? rows.slice(0, opts.limit) : rows;

  return {
    activities: page.map(serializeActivity),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

export type LogActivityInput = {
  summary: string;
  type?: ActivityType;
  notes?: string | null;
  occurredAt?: Date | null;
  contactId?: string | null;
  dealId?: string | null;
};

/**
 * Apuntar una interacción desde fuera es el caso que más se pide: la centralita
 * cuelga una llamada, el buzón recibe un correo, y eso tiene que quedar en el
 * historial de la cuenta sin que nadie lo teclee.
 */
export async function logActivityViaApi(
  user: ApiUser,
  accountId: string,
  input: LogActivityInput,
): Promise<WriteResult<ReturnType<typeof serializeActivity>>> {
  const denied = await requireCrm(user, "crear");
  if (denied) return { ok: false, ...denied };

  const account = await prisma.company.findUnique({ where: { id: accountId }, select: { id: true } });
  if (!account) return { ok: false, status: 404, error: "Cuenta no encontrada" };

  if (!(await contactBelongsTo(input.contactId, accountId))) {
    return { ok: false, status: 400, error: "El contacto no pertenece a esta cuenta." };
  }

  if (input.dealId) {
    const count = await prisma.deal.count({ where: { id: input.dealId, companyId: accountId } });
    if (count === 0) {
      return { ok: false, status: 400, error: "La oportunidad no pertenece a esta cuenta." };
    }
  }

  const created = await prisma.crmActivity.create({
    data: {
      companyId: accountId,
      dealId: input.dealId || null,
      contactId: input.contactId || null,
      type: input.type ?? "NOTA",
      summary: input.summary.trim().slice(0, 200),
      notes: input.notes?.trim() || null,
      occurredAt: input.occurredAt ?? new Date(),
      createdById: user.id,
    },
    select: activitySelect,
  });

  emitActivityHook(created.id, { actor: actorOf(user) });

  return { ok: true, value: serializeActivity(created) };
}
