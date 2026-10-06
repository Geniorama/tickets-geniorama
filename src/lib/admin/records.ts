/**
 * Empresas y planes de Administración, sin sesión de por medio.
 *
 * Las reglas vivían dentro de las Server Actions. Están aquí para que la web y
 * el asistente (MCP) apliquen las mismas: qué puede ser agencia de qué, que no
 * haya dos empresas con el mismo nombre, y cómo se guarda un plan. Quien llama
 * comprueba antes el permiso del módulo.
 *
 * El logo de una empresa se queda en la acción de la web: es un archivo que
 * sube el navegador y no pasa por aquí.
 */

import { prisma } from "@/lib/prisma";
import type { CompanyType, PlanType } from "@/generated/prisma";
import { recordActivity } from "@/lib/activity/record";

type Actor = { id: string; name?: string | null };
export type Resultado = { ok: true; id: string } | { ok: false; error: string };

// ─── Empresas ────────────────────────────────────────────────────────────────

export type CompanyInput = {
  name: string;
  taxId?: string | null;
  type: CompanyType;
  parentId?: string | null;
};

/**
 * Lo que tiene que cumplir una empresa para guardarse. `companyId` es la que se
 * está editando, o nada si es nueva. Devuelve el motivo del rechazo, o `null`.
 */
export async function validarEmpresa(d: CompanyInput, companyId?: string): Promise<string | null> {
  if (d.type === "AGENCIA" && d.parentId) {
    return "Una agencia no puede pertenecer a otra empresa";
  }

  // Al pasar a EMPRESA no puede quedarse con subempresas colgando
  if (companyId && d.type === "EMPRESA") {
    const subCount = await prisma.company.count({ where: { parentId: companyId } });
    if (subCount > 0) return "No puedes cambiar a Empresa porque tiene subempresas asociadas";
  }

  if (d.type === "EMPRESA" && d.parentId) {
    if (d.parentId === companyId) return "Una empresa no puede ser su propia agencia";
    const parent = await prisma.company.findUnique({ where: { id: d.parentId }, select: { type: true } });
    if (!parent) return "La agencia seleccionada no existe";
    if (parent.type !== "AGENCIA") return "La empresa padre debe ser de tipo Agencia";
  }

  const duplicate = await prisma.company.findFirst({
    where: {
      name: { equals: d.name, mode: "insensitive" },
      ...(companyId ? { NOT: { id: companyId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return "Ya existe una empresa con ese nombre";

  return null;
}

/** Los campos de una empresa tal como se guardan (una agencia no tiene padre). */
export function datosEmpresa(d: CompanyInput) {
  return {
    name: d.name,
    taxId: d.taxId?.trim() || null,
    type: d.type,
    parentId: d.type === "EMPRESA" ? (d.parentId ?? null) : null,
  };
}

export async function crearEmpresa(d: CompanyInput): Promise<Resultado> {
  const error = await validarEmpresa(d);
  if (error) return { ok: false, error };
  const company = await prisma.company.create({ data: datosEmpresa(d), select: { id: true } });
  return { ok: true, id: company.id };
}

// ─── Planes ──────────────────────────────────────────────────────────────────

export type PlanInput = {
  name: string;
  type: PlanType;
  companyId: string;
  totalHours?: number | null;
  durationDays?: number | null;
  startedAt: Date;
  expiresAt?: Date | null;
  prioritySupport: boolean;
  aiTools: boolean;
};

async function validarPlan(d: PlanInput): Promise<string | null> {
  if (d.type === "BOLSA_HORAS" && !d.totalHours) {
    return "El total de horas es requerido para Bolsa de Horas";
  }
  const company = await prisma.company.findUnique({ where: { id: d.companyId }, select: { id: true } });
  return company ? null : "Empresa no encontrada";
}

/** Solo una bolsa lleva horas; la duración y la fecha se limpian si no vienen. */
function datosPlan(d: PlanInput) {
  return {
    name: d.name,
    type: d.type,
    companyId: d.companyId,
    totalHours: d.type === "BOLSA_HORAS" ? (d.totalHours ?? null) : null,
    durationDays: d.durationDays ?? null,
    startedAt: d.startedAt,
    expiresAt: d.expiresAt ?? null,
    prioritySupport: d.prioritySupport,
    aiTools: d.aiTools,
  };
}

export async function crearPlan(actor: Actor, d: PlanInput): Promise<Resultado> {
  const error = await validarPlan(d);
  if (error) return { ok: false, error };

  const plan = await prisma.plan.create({ data: datosPlan(d), select: { id: true, name: true } });

  recordActivity({
    entityType: "PLAN",
    entityId: plan.id,
    action: "plan.created",
    label: plan.name,
    actor,
  });

  return { ok: true, id: plan.id };
}

export async function actualizarPlan(actor: Actor, planId: string, d: PlanInput): Promise<Resultado> {
  const existe = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!existe) return { ok: false, error: "Plan no encontrado" };
  const error = await validarPlan(d);
  if (error) return { ok: false, error };

  await prisma.plan.update({ where: { id: planId }, data: datosPlan(d) });

  recordActivity({
    entityType: "PLAN",
    entityId: planId,
    action: "plan.updated",
    label: d.name,
    // Un plan es todo condiciones —horas, duración, vigencia— y compararlas
    // campo a campo llenaría el historial de ruido. Basta con saber quién lo
    // tocó y cuándo: la ficha guarda el estado actual.
    force: true,
    actor,
  });

  return { ok: true, id: planId };
}

export async function setPlanActivo(actor: Actor, planId: string, isActive: boolean): Promise<Resultado> {
  const antes = await prisma.plan.findUnique({ where: { id: planId }, select: { isActive: true } });
  if (!antes) return { ok: false, error: "Plan no encontrado" };

  const plan = await prisma.plan.update({ where: { id: planId }, data: { isActive }, select: { name: true } });

  recordActivity({
    entityType: "PLAN",
    entityId: planId,
    action: "plan.updated",
    label: plan.name,
    changes: { isActive: { from: antes.isActive, to: isActive } },
    actor,
  });

  return { ok: true, id: planId };
}
