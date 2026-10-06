/**
 * Crear y editar sitios y servicios de Infraestructura, sin sesión de por
 * medio.
 *
 * Vivía dentro de las Server Actions; está aquí para que la web y el asistente
 * (MCP) guarden igual y dejen el mismo historial. Quien llama comprueba antes
 * el permiso del módulo; aquí solo se valida el dato.
 */

import { prisma } from "@/lib/prisma";
import type { ServiceProvider, ServiceType } from "@/generated/prisma";
import { recordActivity, recordUpdate } from "@/lib/activity/record";

type Actor = { id: string; name?: string | null };
export type Resultado = { ok: true; id: string } | { ok: false; error: string };

async function empresaExiste(companyId: string): Promise<boolean> {
  return !!(await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }));
}

// ─── Sitios ──────────────────────────────────────────────────────────────────

export type SiteInput = {
  name: string;
  domain: string;
  companyId: string;
  documentation?: string | null;
  architecture?: string | null;
  isActive: boolean;
};

export async function crearSitio(actor: Actor, d: SiteInput): Promise<Resultado> {
  if (!(await empresaExiste(d.companyId))) return { ok: false, error: "Empresa no encontrada" };

  const site = await prisma.site.create({
    data: {
      name: d.name,
      domain: d.domain,
      companyId: d.companyId,
      documentation: d.documentation ?? null,
      architecture: d.architecture ?? null,
      isActive: d.isActive,
    },
    select: { id: true },
  });

  recordActivity({
    entityType: "SITE",
    entityId: site.id,
    action: "site.created",
    label: d.name,
    meta: { note: d.domain },
    actor,
  });

  return { ok: true, id: site.id };
}

export async function actualizarSitio(actor: Actor, siteId: string, d: SiteInput): Promise<Resultado> {
  const antes = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true, domain: true, isActive: true },
  });
  if (!antes) return { ok: false, error: "Sitio no encontrado" };
  if (!(await empresaExiste(d.companyId))) return { ok: false, error: "Empresa no encontrada" };

  await prisma.site.update({
    where: { id: siteId },
    data: {
      name: d.name,
      domain: d.domain,
      companyId: d.companyId,
      documentation: d.documentation ?? null,
      architecture: d.architecture ?? null,
      isActive: d.isActive,
    },
  });

  recordUpdate({
    entityType: "SITE",
    entityId: siteId,
    action: "site.updated",
    label: d.name,
    before: antes,
    after: { name: d.name, domain: d.domain, isActive: d.isActive },
    extraFields: ["name", "domain", "isActive"],
    actor,
  });

  return { ok: true, id: siteId };
}

// ─── Servicios ───────────────────────────────────────────────────────────────

export type ServiceInput = {
  name: string;
  type: ServiceType;
  provider: ServiceProvider;
  description?: string | null;
  dueDate: Date | null;
  price: number | null;
  notes?: string | null;
  isActive: boolean;
  companyId: string;
};

export async function crearServicio(actor: Actor, d: ServiceInput): Promise<Resultado> {
  if (!(await empresaExiste(d.companyId))) return { ok: false, error: "Empresa no encontrada" };

  const servicio = await prisma.service.create({
    data: {
      name: d.name,
      type: d.type,
      provider: d.provider,
      description: d.description ?? null,
      dueDate: d.dueDate,
      price: d.price,
      notes: d.notes ?? null,
      isActive: d.isActive,
      companyId: d.companyId,
      createdById: actor.id,
    },
    select: { id: true },
  });

  recordActivity({
    entityType: "SERVICE",
    entityId: servicio.id,
    action: "service.created",
    label: d.name,
    actor,
  });

  return { ok: true, id: servicio.id };
}

export async function actualizarServicio(actor: Actor, serviceId: string, d: ServiceInput): Promise<Resultado> {
  const antes = await prisma.service.findUnique({
    where: { id: serviceId },
    select: { name: true, dueDate: true, isActive: true },
  });
  if (!antes) return { ok: false, error: "Servicio no encontrado" };
  if (!(await empresaExiste(d.companyId))) return { ok: false, error: "Empresa no encontrada" };

  await prisma.service.update({
    where: { id: serviceId },
    data: {
      name: d.name,
      type: d.type,
      provider: d.provider,
      description: d.description ?? null,
      dueDate: d.dueDate,
      price: d.price,
      notes: d.notes ?? null,
      isActive: d.isActive,
      companyId: d.companyId,
    },
  });

  recordUpdate({
    entityType: "SERVICE",
    entityId: serviceId,
    action: "service.updated",
    label: d.name,
    before: antes,
    after: {
      name: d.name,
      // La fecha de renovación es lo que más se mira de un servicio: moverla
      // cambia cuándo salta el aviso de vencimiento.
      dueDate: d.dueDate,
      isActive: d.isActive,
    },
    extraFields: ["name", "dueDate", "isActive"],
    actor,
  });

  return { ok: true, id: serviceId };
}
