/**
 * Herramientas de Facturación para el servidor MCP: cobros, sus líneas y sus
 * abonos.
 *
 * Escriben a través de `lib/billing` —`crearCobro`, `actualizarCobro`,
 * `moveBillingStatus`, `abonar`—, las mismas funciones que usa la web, así que
 * los totales se calculan en el servidor, el archivo tiene la misma puerta y
 * todo queda en el historial del cobro.
 *
 * Mismo criterio que el CRM: solo se registran si el usuario tiene el módulo
 * (`can()`), las de crear y editar solo con ese nivel, y nunca para clientes
 * (el módulo no los admite). Borrar un cobro se queda fuera a propósito: borra
 * el rastro de un dinero y es mejor hacerlo mirando la pantalla.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { BillingStatus, Prisma } from "@/generated/prisma";
import { can } from "@/lib/access/can";
import type { ApiUser } from "@/lib/api/respond";
import {
  BILLING_STATUSES, BILLING_STATUS_LABELS, BILLING_STATUS_DESCRIPTIONS,
  CLOSED_BILLING_STATUSES, INVOICED_STATUSES, pendiente,
} from "@/lib/billing/status";
import { moveBillingStatus } from "@/lib/billing/move";
import { abonar, actualizarCobro, crearCobro, type CobroInput } from "@/lib/billing/items";

const STATUS = z.enum(BILLING_STATUSES as [BillingStatus, ...BillingStatus[]]);
const STATUS_HELP = BILLING_STATUSES.map((s) => `${s}: ${BILLING_STATUS_DESCRIPTIONS[s]}`).join(" ");

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
  .describe("Fecha ISO, p. ej. 2026-10-20");

const line = z.object({
  concept: z.string().trim().min(1).max(2000).describe("Lo que verá el cliente en la factura"),
  amount: z.number().positive().describe("Base imponible, sin IVA, en pesos"),
  taxRate: z.number().min(0).max(100).optional().describe("Porcentaje de IVA: 19 o 0 (exento, por defecto)"),
  categoryId: z.string().nullable().optional().describe("Categoría contable (billing_list_categories)"),
});

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** «2026-10-20» a mediodía, como la web: a medianoche un huso lo pasa al día anterior. */
function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
}

const itemSelect = {
  id: true, concept: true, status: true,
  amount: true, subtotal: true, taxAmount: true, paidAmount: true,
  dueDate: true, invoiceDueDate: true, invoiceNumber: true, invoicedAt: true, paidAt: true,
  notes: true, remindersOff: true, createdAt: true,
  company: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  labels: { select: { name: true } },
} satisfies Prisma.BillingItemSelect;

type ItemRow = Prisma.BillingItemGetPayload<{ select: typeof itemSelect }>;

function serialize(row: ItemRow) {
  return {
    id: row.id,
    concept: row.concept,
    status: row.status,
    statusLabel: BILLING_STATUS_LABELS[row.status],
    company: row.company,
    owner: row.owner,
    total: row.amount,
    subtotal: row.subtotal,
    tax: row.taxAmount,
    paid: row.paidAmount,
    pending: pendiente(row.amount, row.paidAmount),
    dueDate: row.dueDate?.toISOString() ?? null,
    invoiceDueDate: row.invoiceDueDate?.toISOString() ?? null,
    invoiceNumber: row.invoiceNumber,
    invoicedAt: row.invoicedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    labels: row.labels.map((l) => l.name),
    notes: row.notes,
    remindersOff: row.remindersOff,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Facturado, sin cobrar del todo y con el vencimiento pasado. */
function overdueWhere(now: Date): Prisma.BillingItemWhereInput {
  return {
    status: { in: INVOICED_STATUSES.filter((s) => !CLOSED_BILLING_STATUSES.includes(s)) },
    invoiceDueDate: { lt: now },
  };
}

export async function registerBillingTools(server: McpServer, user: ApiUser, canWrite: boolean): Promise<void> {
  const [canSee, canCreate, canEdit] = await Promise.all([
    can(user, "FACTURACION", "ver"),
    can(user, "FACTURACION", "crear"),
    can(user, "FACTURACION", "editar"),
  ]);
  if (!canSee) return;

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

  /** El responsable tiene que ser alguien del equipo, activo. */
  async function resolveOwner(id: string | null | undefined): Promise<string | null | undefined | Error> {
    if (id === undefined || id === null) return id;
    const ownerId = id === "me" ? user.id : id;
    const owner = await prisma.user.findFirst({
      where: { id: ownerId, isActive: true, role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
      select: { id: true },
    });
    return owner ? owner.id : new Error("El responsable no existe, está inactivo o no es del equipo.");
  }

  // ─── Lectura ───────────────────────────────────────────────────────────────

  server.registerTool(
    "billing_summary",
    {
      title: "Facturación: resumen",
      description:
        "Cuántos cobros y cuánto dinero hay en cada estado (sin el archivo), cuánto falta por cobrar y " +
        "qué está vencido. Es la vista rápida del tablero.",
      annotations: readOnly,
    },
    async () => {
      const now = new Date();
      const [groups, overdue] = await Promise.all([
        prisma.billingItem.groupBy({
          by: ["status"],
          where: { status: { not: "ARCHIVADO" } },
          _count: { _all: true },
          _sum: { amount: true, paidAmount: true },
        }),
        prisma.billingItem.findMany({ where: overdueWhere(now), select: { amount: true, paidAmount: true } }),
      ]);
      const byStatus = BILLING_STATUSES.filter((s) => s !== "ARCHIVADO").map((s) => {
        const g = groups.find((x) => x.status === s);
        const total = g?._sum.amount ?? 0;
        const paid = g?._sum.paidAmount ?? 0;
        return { status: s, label: BILLING_STATUS_LABELS[s], count: g?._count._all ?? 0, total, pending: pendiente(total, paid) };
      });
      const pendingInvoiced = byStatus
        .filter((s) => s.status === "FACTURADO" || s.status === "ABONADO")
        .reduce((acc, s) => acc + s.pending, 0);
      return ok({
        byStatus,
        pendingToCollect: pendingInvoiced,
        overdue: {
          count: overdue.length,
          pending: overdue.reduce((acc, o) => acc + pendiente(o.amount, o.paidAmount), 0),
        },
        currency: "COP",
      });
    },
  );

  server.registerTool(
    "billing_list",
    {
      title: "Facturación: listar cobros",
      description:
        "Cobros, del más reciente al más antiguo. Sin filtro de estado deja fuera el archivo. " +
        "overdue=true devuelve solo facturas vencidas sin cobrar del todo. Estados: " + STATUS_HELP,
      inputSchema: {
        status: z.array(STATUS).optional(),
        companyId: z.string().optional(),
        search: z.string().optional().describe("Busca en el concepto, el número de factura o la empresa"),
        overdue: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: readOnly,
    },
    async ({ status, companyId, search, overdue, limit, cursor }) => {
      const q = search?.trim();
      const take = limit ?? 25;
      const where: Prisma.BillingItemWhereInput = {
        AND: [
          status?.length ? { status: { in: status } } : { status: { not: "ARCHIVADO" } },
          ...(companyId ? [{ companyId }] : []),
          ...(overdue ? [overdueWhere(new Date())] : []),
          ...(q
            ? [{
                OR: [
                  { concept: { contains: q, mode: "insensitive" as const } },
                  { invoiceNumber: { contains: q, mode: "insensitive" as const } },
                  { company: { name: { contains: q, mode: "insensitive" as const } } },
                ],
              }]
            : []),
        ],
      };
      const rows = await prisma.billingItem.findMany({
        where,
        select: itemSelect,
        orderBy: { createdAt: "desc" },
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > take;
      const page = hasMore ? rows.slice(0, take) : rows;
      return ok({ items: page.map(serialize), nextCursor: hasMore ? page[page.length - 1].id : null });
    },
  );

  server.registerTool(
    "billing_get",
    {
      title: "Facturación: ver cobro",
      description: "Un cobro con sus líneas (base, IVA y categoría) y sus abonos.",
      inputSchema: { billingItemId: z.string() },
      annotations: readOnly,
    },
    async ({ billingItemId }) => {
      const row = await prisma.billingItem.findUnique({
        where: { id: billingItemId },
        select: {
          ...itemSelect,
          lines: {
            orderBy: { position: "asc" },
            select: { concept: true, amount: true, taxRate: true, category: { select: { id: true, name: true } } },
          },
          payments: {
            orderBy: { paidOn: "asc" },
            select: { id: true, amount: true, paidOn: true, method: true, note: true, registeredBy: { select: { name: true } } },
          },
        },
      });
      if (!row) return fail("Cobro no encontrado");
      return ok({
        item: {
          ...serialize(row),
          lines: row.lines,
          payments: row.payments.map((p) => ({ ...p, paidOn: p.paidOn.toISOString(), registeredBy: p.registeredBy.name })),
        },
      });
    },
  );

  server.registerTool(
    "billing_list_companies",
    {
      title: "Facturación: empresas",
      description: "Empresas activas a las que se puede cobrar, para obtener su id.",
      inputSchema: { search: z.string().optional().describe("Parte del nombre") },
      annotations: readOnly,
    },
    async ({ search }) => {
      const q = search?.trim();
      const companies = await prisma.company.findMany({
        where: { isActive: true, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
        take: 50,
      });
      return ok({ companies });
    },
  );

  server.registerTool(
    "billing_list_categories",
    {
      title: "Facturación: categorías",
      description: "Categorías contables activas (hosting, desarrollo, marketing…) para catalogar las líneas.",
      annotations: readOnly,
    },
    async () =>
      ok({
        categories: await prisma.billingCategory.findMany({
          where: { isActive: true },
          orderBy: { position: "asc" },
          select: { id: true, name: true },
        }),
      }),
  );

  if (!canWrite) return;

  // ─── Crear ─────────────────────────────────────────────────────────────────

  if (canCreate) {
    server.registerTool(
      "billing_create",
      {
        title: "Facturación: crear cobro",
        description:
          "Crea un cobro con sus líneas. Los totales (base, IVA y total) los calcula el servidor. Sin estado " +
          "nace en BACKLOG; no puede nacer archivado. invoiceNumber e invoiceDueDate solo se guardan si el " +
          "estado ya es FACTURADO o posterior.",
        inputSchema: {
          concept: z.string().trim().min(1).max(200).describe("Qué se cobra, en una línea"),
          companyId: z.string(),
          lines: z.array(line).min(1),
          status: STATUS.optional(),
          dueDate: date.nullable().optional().describe("Cuándo toca emitir la factura"),
          invoiceDueDate: date.nullable().optional().describe("Cuándo vence la factura emitida"),
          invoiceNumber: z.string().trim().max(60).optional(),
          ownerId: z.string().nullable().optional().describe('Quién lo persigue: id del equipo o "me"'),
          notes: z.string().max(4000).optional(),
        },
        annotations: write,
      },
      async (a) => {
        const owner = await resolveOwner(a.ownerId);
        if (owner instanceof Error) return fail(owner.message);
        const r = await crearCobro(user, {
          concept: a.concept,
          companyId: a.companyId,
          status: a.status ?? "BACKLOG",
          lines: a.lines.map((l) => ({ concept: l.concept, amount: l.amount, taxRate: l.taxRate ?? 0, categoryId: l.categoryId ?? null })),
          dueDate: toDate(a.dueDate) ?? null,
          invoiceDueDate: toDate(a.invoiceDueDate) ?? null,
          invoiceNumber: a.invoiceNumber,
          ownerId: owner ?? undefined,
          notes: a.notes,
        });
        if (!r.ok) return fail(r.error);
        const row = await prisma.billingItem.findUnique({ where: { id: r.id }, select: itemSelect });
        return ok({ item: row ? serialize(row) : { id: r.id } });
      },
    );
  }

  // ─── Editar ────────────────────────────────────────────────────────────────

  if (canEdit) {
    server.registerTool(
      "billing_update",
      {
        title: "Facturación: editar cobro",
        description:
          "Cambia solo los campos que se envíen. Si se envían lines, reemplazan a todas las anteriores y los " +
          "totales se recalculan. Para mover de estado usa billing_set_status; para registrar dinero que " +
          "entró, billing_add_payment.",
        inputSchema: {
          billingItemId: z.string(),
          concept: z.string().trim().min(1).max(200).optional(),
          lines: z.array(line).min(1).optional(),
          dueDate: date.nullable().optional(),
          invoiceDueDate: date.nullable().optional(),
          invoiceNumber: z.string().trim().max(60).nullable().optional(),
          ownerId: z.string().nullable().optional().describe('Id del equipo, "me" o null'),
          notes: z.string().max(4000).nullable().optional(),
        },
        annotations: write,
      },
      async (a) => {
        const current = await prisma.billingItem.findUnique({
          where: { id: a.billingItemId },
          select: {
            concept: true, companyId: true, status: true, dueDate: true, invoiceDueDate: true,
            invoiceNumber: true, ownerId: true, notes: true,
            lines: { orderBy: { position: "asc" }, select: { concept: true, amount: true, taxRate: true, categoryId: true } },
          },
        });
        if (!current) return fail("Cobro no encontrado");
        const owner = await resolveOwner(a.ownerId);
        if (owner instanceof Error) return fail(owner.message);

        // Lo no enviado se queda como está; el estado no se toca desde aquí
        const input: CobroInput = {
          concept: a.concept ?? current.concept,
          companyId: current.companyId,
          status: current.status,
          lines: a.lines
            ? a.lines.map((l) => ({ concept: l.concept, amount: l.amount, taxRate: l.taxRate ?? 0, categoryId: l.categoryId ?? null }))
            : current.lines,
          dueDate: a.dueDate !== undefined ? (toDate(a.dueDate) ?? null) : current.dueDate,
          invoiceDueDate: a.invoiceDueDate !== undefined ? (toDate(a.invoiceDueDate) ?? null) : current.invoiceDueDate,
          invoiceNumber: (a.invoiceNumber !== undefined ? a.invoiceNumber : current.invoiceNumber) ?? undefined,
          ownerId: (owner !== undefined ? owner : current.ownerId) ?? undefined,
          notes: (a.notes !== undefined ? a.notes : current.notes) ?? undefined,
        };
        const r = await actualizarCobro(user, a.billingItemId, input);
        if (!r.ok) return fail(r.error);
        const row = await prisma.billingItem.findUnique({ where: { id: r.id }, select: itemSelect });
        return ok({ item: row ? serialize(row) : { id: r.id } });
      },
    );

    server.registerTool(
      "billing_set_status",
      {
        title: "Facturación: mover de estado",
        description:
          "Mueve un cobro de columna, como arrastrarlo en el tablero. Pasar a PAGADO o ARCHIVADO registra como " +
          "abono el saldo pendiente. Con abonos registrados no se puede devolver a un estado anterior a " +
          "ABONADO. Al archivo solo se llega desde PAGADO. Estados: " + STATUS_HELP,
        inputSchema: { billingItemId: z.string(), status: STATUS },
        annotations: write,
      },
      async ({ billingItemId, status }) => {
        const r = await moveBillingStatus(billingItemId, status, user);
        if (!r.ok) return fail(r.error);
        const row = await prisma.billingItem.findUnique({ where: { id: billingItemId }, select: itemSelect });
        return ok({ item: row ? serialize(row) : { id: billingItemId } });
      },
    );

    server.registerTool(
      "billing_add_payment",
      {
        title: "Facturación: registrar abono",
        description:
          "Apunta dinero que entró a cuenta de un cobro ya facturado. El estado se ajusta solo: ABONADO si " +
          "falta saldo, PAGADO si queda cubierto.",
        inputSchema: {
          billingItemId: z.string(),
          amount: z.number().positive().describe("Cuánto entró, en pesos"),
          paidOn: date.optional().describe("Cuándo entró; por defecto, hoy"),
          method: z.string().trim().max(80).optional().describe("Transferencia Bancolombia, Efectivo, PSE…"),
          note: z.string().trim().max(500).optional(),
        },
        annotations: write,
      },
      async ({ billingItemId, amount, paidOn, method, note }) => {
        const when = toDate(paidOn) ?? toDate(new Date().toISOString().slice(0, 10))!;
        const r = await abonar(user, billingItemId, { amount, paidOn: when, method, note });
        if (!r.ok) return fail(r.error);
        const row = await prisma.billingItem.findUnique({ where: { id: billingItemId }, select: itemSelect });
        return ok({ paymentId: r.id, item: row ? serialize(row) : { id: billingItemId } });
      },
    );
  }
}
