/**
 * Herramientas de Administración para el servidor MCP: empresas y planes.
 *
 * Escriben a través de `lib/admin/records`, lo mismo que la web. En la
 * plataforma, Empresas y Planes piden nivel Gestor en Administración para todo
 * —ver incluido—, así que aquí también: sin ese nivel no aparece ninguna, y
 * nunca para clientes.
 *
 * Fuera a propósito:
 *   · Borrar. Una empresa arrastra usuarios, planes y proyectos; un plan,
 *     sus tickets. Mejor hacerlo mirando la pantalla.
 *   · El logo de la empresa: es un archivo que sube el navegador.
 *   · Usuarios: dar de alta o cambiar permisos de personas no se delega en un
 *     asistente.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { can } from "@/lib/access/can";
import type { ApiUser } from "@/lib/api/respond";
import { daysUntilExpiry, getEffectiveExpiresAt, isPlanExpired } from "@/lib/plans";
import { getPlanUsedHours } from "@/lib/time-entries";
import {
  actualizarPlan, crearEmpresa, crearPlan, datosEmpresa, setPlanActivo, validarEmpresa,
} from "@/lib/admin/records";

const COMPANY_TYPE = z.enum(["AGENCIA", "EMPRESA"]).describe("AGENCIA agrupa empresas; EMPRESA es un cliente final");
const PLAN_TYPE = z.enum(["BOLSA_HORAS", "SOPORTE_MENSUAL"]);
const PLAN_STATE = z.enum(["VIGENTE", "VENCIDO", "AGOTADO", "INACTIVO"]);

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
  .describe("Fecha ISO, p. ej. 2026-10-20");

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
}

const companySelect = {
  id: true, name: true, type: true, taxId: true, isActive: true, stage: true, createdAt: true,
  parent: { select: { id: true, name: true } },
  _count: { select: { users: true, plans: true, projects: true, subCompanies: true } },
} satisfies Prisma.CompanySelect;

function serializeCompany(c: Prisma.CompanyGetPayload<{ select: typeof companySelect }>) {
  const { _count, parent, ...rest } = c;
  return { ...rest, createdAt: c.createdAt.toISOString(), agency: parent, counts: _count };
}

const planSelect = {
  id: true, name: true, type: true, totalHours: true, durationDays: true, startedAt: true,
  expiresAt: true, isActive: true, prioritySupport: true, aiTools: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.PlanSelect;

type PlanRow = Prisma.PlanGetPayload<{ select: typeof planSelect }>;

/** El plan con lo que de verdad se pregunta: ¿sigue vigente y cuánto le queda? */
async function serializePlan(p: PlanRow) {
  const usedHours = p.type === "BOLSA_HORAS" ? await getPlanUsedHours(p.id) : null;
  const exhausted = p.type === "BOLSA_HORAS" && p.totalHours !== null && (usedHours ?? 0) >= p.totalHours;
  const state = !p.isActive ? "INACTIVO" : isPlanExpired(p) ? "VENCIDO" : exhausted ? "AGOTADO" : "VIGENTE";
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    company: p.company,
    state,
    isActive: p.isActive,
    totalHours: p.totalHours,
    usedHours: usedHours === null ? null : Math.round(usedHours * 100) / 100,
    remainingHours:
      usedHours === null || p.totalHours === null ? null : Math.max(0, Math.round((p.totalHours - usedHours) * 100) / 100),
    startedAt: p.startedAt.toISOString(),
    durationDays: p.durationDays,
    expiresAt: getEffectiveExpiresAt(p)?.toISOString() ?? null,
    daysToExpiry: daysUntilExpiry(p),
    prioritySupport: p.prioritySupport,
    aiTools: p.aiTools,
  };
}

export async function registerAdminTools(server: McpServer, user: ApiUser, canWrite: boolean): Promise<void> {
  if (!(await can(user, "ADMIN", "gestionar"))) return;

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

  // ─── Empresas ──────────────────────────────────────────────────────────────

  server.registerTool(
    "admin_list_companies",
    {
      title: "Administración: listar empresas",
      description:
        "Empresas y agencias con su NIT, estado, agencia a la que pertenecen y cuántos usuarios, planes y " +
        "proyectos tienen. Por defecto solo las activas. Para solo obtener un id, basta list_companies.",
      inputSchema: {
        search: z.string().optional().describe("Parte del nombre o del NIT"),
        type: COMPANY_TYPE.optional(),
        includeInactive: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        cursor: z.string().optional(),
      },
      annotations: readOnly,
    },
    async ({ search, type, includeInactive, limit, cursor }) => {
      const q = search?.trim();
      const take = limit ?? 25;
      const rows = await prisma.company.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(type ? { type } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { taxId: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: companySelect,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: take + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > take;
      const page = hasMore ? rows.slice(0, take) : rows;
      return ok({ companies: page.map(serializeCompany), nextCursor: hasMore ? page[page.length - 1].id : null });
    },
  );

  server.registerTool(
    "admin_get_company",
    {
      title: "Administración: ver empresa",
      description: "Una empresa con sus usuarios, sus planes (con vigencia y horas restantes) y sus subempresas.",
      inputSchema: { companyId: z.string() },
      annotations: readOnly,
    },
    async ({ companyId }) => {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: {
          ...companySelect,
          subCompanies: { select: { id: true, name: true, isActive: true }, orderBy: { name: "asc" } },
          users: { select: { id: true, name: true, email: true, role: true, isActive: true }, orderBy: { name: "asc" } },
          plans: { select: planSelect, orderBy: { startedAt: "desc" } },
        },
      });
      if (!company) return fail("Empresa no encontrada");
      const { subCompanies, users, plans, ...base } = company;
      return ok({
        company: {
          ...serializeCompany(base),
          subCompanies,
          users,
          plans: await Promise.all(plans.map(serializePlan)),
        },
      });
    },
  );

  // ─── Planes ────────────────────────────────────────────────────────────────

  server.registerTool(
    "admin_list_plans",
    {
      title: "Administración: listar planes",
      description:
        "Planes de soporte de los clientes con su estado (VIGENTE, VENCIDO, AGOTADO o INACTIVO), las horas " +
        "usadas y restantes de las bolsas y los días que faltan para vencer. expiringInDays=30 devuelve los " +
        "vigentes que vencen en los próximos 30 días.",
      inputSchema: {
        companyId: z.string().optional(),
        type: PLAN_TYPE.optional(),
        state: PLAN_STATE.optional(),
        expiringInDays: z.number().int().min(0).max(3650).optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
    },
    async ({ companyId, type, state, expiringInDays, limit }) => {
      // El estado depende de fechas y horas consumidas, así que se calcula
      // aquí y se filtra después: no hay forma de pedírselo a la base.
      const rows = await prisma.plan.findMany({
        where: {
          ...(companyId ? { companyId } : {}),
          ...(type ? { type } : {}),
          ...(state === "INACTIVO" ? { isActive: false } : state ? { isActive: true } : {}),
        },
        select: planSelect,
        orderBy: [{ isActive: "desc" }, { startedAt: "desc" }],
        take: 300,
      });
      let plans = await Promise.all(rows.map(serializePlan));
      if (state) plans = plans.filter((p) => p.state === state);
      if (expiringInDays !== undefined) {
        plans = plans.filter(
          (p) => p.state === "VIGENTE" && p.daysToExpiry !== null && p.daysToExpiry <= expiringInDays,
        );
        plans.sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
      }
      return ok({ plans: plans.slice(0, limit ?? 50), total: plans.length });
    },
  );

  server.registerTool(
    "admin_get_plan",
    {
      title: "Administración: ver plan",
      description: "Un plan con su estado, vigencia y horas, y cuántos tickets se han abierto contra él.",
      inputSchema: { planId: z.string() },
      annotations: readOnly,
    },
    async ({ planId }) => {
      const plan = await prisma.plan.findUnique({ where: { id: planId }, select: planSelect });
      if (!plan) return fail("Plan no encontrado");
      const [tickets, openTickets] = await Promise.all([
        prisma.ticket.count({ where: { planId } }),
        prisma.ticket.count({ where: { planId, status: { not: "CERRADO" } } }),
      ]);
      return ok({ plan: { ...(await serializePlan(plan)), tickets, openTickets } });
    },
  );

  if (!canWrite) return;

  // ─── Escritura ─────────────────────────────────────────────────────────────

  server.registerTool(
    "admin_create_company",
    {
      title: "Administración: crear empresa",
      description:
        "Crea una empresa o una agencia. No puede haber dos con el mismo nombre. Una EMPRESA puede colgar de " +
        "una AGENCIA (parentId); una agencia no cuelga de nadie.",
      inputSchema: {
        name: z.string().trim().min(1).max(200),
        type: COMPANY_TYPE.optional(),
        taxId: z.string().trim().max(60).optional().describe("NIT"),
        parentId: z.string().optional().describe("Id de la agencia a la que pertenece"),
      },
      annotations: write,
    },
    async (a) => {
      const r = await crearEmpresa({ name: a.name, type: a.type ?? "EMPRESA", taxId: a.taxId, parentId: a.parentId });
      if (!r.ok) return fail(r.error);
      const company = await prisma.company.findUnique({ where: { id: r.id }, select: companySelect });
      return ok({ company: company ? serializeCompany(company) : { id: r.id } });
    },
  );

  server.registerTool(
    "admin_update_company",
    {
      title: "Administración: editar empresa",
      description:
        "Cambia solo los campos que se envíen. isActive=false la desactiva sin borrarla. parentId=null la " +
        "saca de su agencia.",
      inputSchema: {
        companyId: z.string(),
        name: z.string().trim().min(1).max(200).optional(),
        type: COMPANY_TYPE.optional(),
        taxId: z.string().trim().max(60).nullable().optional(),
        parentId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      },
      annotations: write,
    },
    async ({ companyId, isActive, ...a }) => {
      const cur = await prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true, type: true, taxId: true, parentId: true },
      });
      if (!cur) return fail("Empresa no encontrada");

      const input = {
        name: a.name ?? cur.name,
        type: a.type ?? cur.type,
        taxId: a.taxId !== undefined ? a.taxId : cur.taxId,
        parentId: a.parentId !== undefined ? a.parentId : cur.parentId,
      };
      const invalido = await validarEmpresa(input, companyId);
      if (invalido) return fail(invalido);

      const company = await prisma.company.update({
        where: { id: companyId },
        data: { ...datosEmpresa(input), ...(isActive !== undefined ? { isActive } : {}) },
        select: companySelect,
      });
      return ok({ company: serializeCompany(company) });
    },
  );

  server.registerTool(
    "admin_create_plan",
    {
      title: "Administración: crear plan",
      description:
        "Crea un plan de soporte para una empresa. BOLSA_HORAS exige totalHours. La vigencia se da con " +
        "durationDays (días desde el inicio) o con expiresAt (fecha fija); sin ninguna, no vence.",
      inputSchema: {
        name: z.string().trim().min(1).max(200),
        type: PLAN_TYPE,
        companyId: z.string(),
        totalHours: z.number().positive().optional().describe("Horas de la bolsa"),
        startedAt: date.optional().describe("Inicio; por defecto, hoy"),
        durationDays: z.number().int().positive().optional(),
        expiresAt: date.optional(),
        prioritySupport: z.boolean().optional().describe("Da a los clientes los links de agendamiento prioritarios"),
        aiTools: z.boolean().optional().describe("Da a los clientes las herramientas de IA de sus fichas"),
      },
      annotations: write,
    },
    async (a) => {
      const r = await crearPlan(user, {
        name: a.name,
        type: a.type,
        companyId: a.companyId,
        totalHours: a.totalHours ?? null,
        durationDays: a.durationDays ?? null,
        startedAt: toDate(a.startedAt) ?? new Date(),
        expiresAt: toDate(a.expiresAt) ?? null,
        prioritySupport: a.prioritySupport ?? false,
        aiTools: a.aiTools ?? false,
      });
      if (!r.ok) return fail(r.error);
      const plan = await prisma.plan.findUnique({ where: { id: r.id }, select: planSelect });
      return ok({ plan: plan ? await serializePlan(plan) : { id: r.id } });
    },
  );

  server.registerTool(
    "admin_update_plan",
    {
      title: "Administración: editar plan",
      description:
        "Cambia solo los campos que se envíen: horas, vigencia, beneficios… null quita la duración o la fecha " +
        "de vencimiento. isActive=false lo desactiva sin borrarlo. Para renovar una bolsa agotada suele ser " +
        "mejor crear un plan nuevo y desactivar el anterior, así el consumo de cada uno queda separado.",
      inputSchema: {
        planId: z.string(),
        name: z.string().trim().min(1).max(200).optional(),
        type: PLAN_TYPE.optional(),
        totalHours: z.number().positive().nullable().optional(),
        startedAt: date.optional(),
        durationDays: z.number().int().positive().nullable().optional(),
        expiresAt: date.nullable().optional(),
        prioritySupport: z.boolean().optional(),
        aiTools: z.boolean().optional(),
        isActive: z.boolean().optional(),
      },
      annotations: write,
    },
    async ({ planId, isActive, ...a }) => {
      const cur = await prisma.plan.findUnique({
        where: { id: planId },
        select: {
          name: true, type: true, companyId: true, totalHours: true, durationDays: true,
          startedAt: true, expiresAt: true, prioritySupport: true, aiTools: true, isActive: true,
        },
      });
      if (!cur) return fail("Plan no encontrado");

      const touchesFields = Object.values(a).some((v) => v !== undefined);
      if (touchesFields) {
        const r = await actualizarPlan(user, planId, {
          name: a.name ?? cur.name,
          type: a.type ?? cur.type,
          companyId: cur.companyId,
          totalHours: a.totalHours !== undefined ? a.totalHours : cur.totalHours,
          durationDays: a.durationDays !== undefined ? a.durationDays : cur.durationDays,
          startedAt: toDate(a.startedAt) ?? cur.startedAt,
          expiresAt: a.expiresAt !== undefined ? (toDate(a.expiresAt) ?? null) : cur.expiresAt,
          prioritySupport: a.prioritySupport ?? cur.prioritySupport,
          aiTools: a.aiTools ?? cur.aiTools,
        });
        if (!r.ok) return fail(r.error);
      }
      if (isActive !== undefined && isActive !== cur.isActive) {
        const r = await setPlanActivo(user, planId, isActive);
        if (!r.ok) return fail(r.error);
      }

      const plan = await prisma.plan.findUnique({ where: { id: planId }, select: planSelect });
      return ok({ plan: plan ? await serializePlan(plan) : { id: planId } });
    },
  );
}
