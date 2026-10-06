/**
 * Herramientas de Infraestructura para el servidor MCP: sitios y servicios
 * (dominios, hosting, correo, SSL, mantenimiento) con sus vencimientos.
 *
 * Escriben a través de `lib/infra/records`, lo mismo que la web. Mismo
 * criterio que CRM y Facturación: solo se registran con el módulo concedido
 * (`can()`), las de crear y editar con su nivel, y nunca para clientes.
 *
 * Fuera a propósito:
 *   · La Bóveda. Los accesos vinculados a sitios y servicios son contraseñas;
 *     no salen hacia un asistente externo.
 *   · Borrar. Un sitio arrastra sus tickets y un servicio su historial; mejor
 *     hacerlo mirando la pantalla.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { can } from "@/lib/access/can";
import type { ApiUser } from "@/lib/api/respond";
import { actualizarServicio, actualizarSitio, crearServicio, crearSitio } from "@/lib/infra/records";

const SERVICE_TYPE = z.enum(["DOMINIO", "HOSTING", "CORREO", "SSL", "MANTENIMIENTO", "OTRO"]);
const PROVIDER = z.enum(["GENIORAMA", "EXTERNO"]).describe("GENIORAMA si lo gestionamos nosotros, EXTERNO si lo contrata el cliente");

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

/** «2026-10-20» a mediodía: a medianoche un huso horario lo pasa al día anterior. */
function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
}

const DAY = 24 * 60 * 60 * 1000;

const siteSelect = {
  id: true, name: true, domain: true, isActive: true, createdAt: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.SiteSelect;

const serviceSelect = {
  id: true, name: true, type: true, provider: true, description: true, dueDate: true,
  price: true, notes: true, isActive: true, createdAt: true,
  company: { select: { id: true, name: true } },
} satisfies Prisma.ServiceSelect;

function serializeService(s: Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>) {
  const daysToDue = s.dueDate ? Math.ceil((s.dueDate.getTime() - Date.now()) / DAY) : null;
  return {
    ...s,
    dueDate: s.dueDate?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    // Lo que se pregunta de un servicio: ¿cuánto le queda?
    daysToDue,
    expired: daysToDue !== null && daysToDue < 0,
  };
}

export async function registerInfraTools(server: McpServer, user: ApiUser, canWrite: boolean): Promise<void> {
  const [canSee, canCreate, canEdit] = await Promise.all([
    can(user, "INFRAESTRUCTURA", "ver"),
    can(user, "INFRAESTRUCTURA", "crear"),
    can(user, "INFRAESTRUCTURA", "editar"),
  ]);
  if (!canSee) return;

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

  // ─── Sitios ────────────────────────────────────────────────────────────────

  server.registerTool(
    "infra_list_sites",
    {
      title: "Infraestructura: listar sitios",
      description: "Sitios web de los clientes, por nombre. Por defecto solo los activos.",
      inputSchema: {
        companyId: z.string().optional(),
        search: z.string().optional().describe("Parte del nombre o del dominio"),
        includeInactive: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
    },
    async ({ companyId, search, includeInactive, limit }) => {
      const q = search?.trim();
      const sites = await prisma.site.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(companyId ? { companyId } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { domain: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: siteSelect,
        orderBy: { name: "asc" },
        take: limit ?? 50,
      });
      return ok({ sites });
    },
  );

  server.registerTool(
    "infra_get_site",
    {
      title: "Infraestructura: ver sitio",
      description:
        "Un sitio con su documentación y arquitectura, sus servicios y cuántos tickets abiertos tiene. " +
        "Los accesos de la Bóveda no se incluyen.",
      inputSchema: { siteId: z.string() },
      annotations: readOnly,
    },
    async ({ siteId }) => {
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: { ...siteSelect, documentation: true, architecture: true, companyId: true },
      });
      if (!site) return fail("Sitio no encontrado");
      const [services, openTickets] = await Promise.all([
        prisma.service.findMany({
          where: { companyId: site.companyId, isActive: true },
          select: serviceSelect,
          orderBy: { dueDate: "asc" },
        }),
        prisma.ticket.count({ where: { siteId, status: { not: "CERRADO" } } }),
      ]);
      return ok({
        site: {
          id: site.id, name: site.name, domain: site.domain, isActive: site.isActive, company: site.company,
          documentation: site.documentation, architecture: site.architecture, createdAt: site.createdAt,
          // Los servicios cuelgan de la empresa, no del sitio
          companyServices: services.map(serializeService),
          openTickets,
        },
      });
    },
  );

  // ─── Servicios ─────────────────────────────────────────────────────────────

  server.registerTool(
    "infra_list_services",
    {
      title: "Infraestructura: listar servicios",
      description:
        "Dominios, hosting, correo, SSL y mantenimientos, del vencimiento más cercano al más lejano. " +
        "expiringInDays=30 devuelve lo que vence en los próximos 30 días (incluye lo ya vencido); " +
        "expired=true, solo lo vencido. Por defecto solo los activos.",
      inputSchema: {
        companyId: z.string().optional(),
        type: SERVICE_TYPE.optional(),
        provider: PROVIDER.optional(),
        search: z.string().optional().describe("Parte del nombre o la descripción"),
        expiringInDays: z.number().int().min(0).max(3650).optional(),
        expired: z.boolean().optional(),
        includeInactive: z.boolean().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: readOnly,
    },
    async ({ companyId, type, provider, search, expiringInDays, expired, includeInactive, limit }) => {
      const q = search?.trim();
      const now = new Date();
      const dueFilter: Prisma.DateTimeNullableFilter | undefined = expired
        ? { lt: now }
        : expiringInDays !== undefined
          ? { lte: new Date(now.getTime() + expiringInDays * DAY) }
          : undefined;
      const services = await prisma.service.findMany({
        where: {
          ...(includeInactive ? {} : { isActive: true }),
          ...(companyId ? { companyId } : {}),
          ...(type ? { type } : {}),
          ...(provider ? { provider } : {}),
          ...(dueFilter ? { dueDate: dueFilter } : {}),
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: "insensitive" as const } },
                  { description: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        select: serviceSelect,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { name: "asc" }],
        take: limit ?? 50,
      });
      return ok({ services: services.map(serializeService) });
    },
  );

  server.registerTool(
    "infra_get_service",
    {
      title: "Infraestructura: ver servicio",
      description: "Un servicio con su vencimiento, precio y notas. Los accesos de la Bóveda no se incluyen.",
      inputSchema: { serviceId: z.string() },
      annotations: readOnly,
    },
    async ({ serviceId }) => {
      const service = await prisma.service.findUnique({ where: { id: serviceId }, select: serviceSelect });
      return service ? ok({ service: serializeService(service) }) : fail("Servicio no encontrado");
    },
  );

  if (!canWrite) return;

  // ─── Crear ─────────────────────────────────────────────────────────────────

  if (canCreate) {
    server.registerTool(
      "infra_create_site",
      {
        title: "Infraestructura: crear sitio",
        description: "Registra el sitio web de una empresa. companyId sale de list_companies.",
        inputSchema: {
          name: z.string().trim().min(1).max(200),
          domain: z.string().trim().min(1).max(500),
          companyId: z.string(),
          documentation: z.string().optional().describe("Markdown"),
          architecture: z.string().optional().describe("Markdown: stack, servidor, despliegue…"),
          isActive: z.boolean().optional(),
        },
        annotations: write,
      },
      async (a) => {
        const r = await crearSitio(user, { ...a, isActive: a.isActive ?? true });
        if (!r.ok) return fail(r.error);
        return ok({ site: await prisma.site.findUnique({ where: { id: r.id }, select: siteSelect }) });
      },
    );

    server.registerTool(
      "infra_create_service",
      {
        title: "Infraestructura: crear servicio",
        description: "Registra un dominio, hosting, correo, SSL, mantenimiento u otro servicio de una empresa.",
        inputSchema: {
          name: z.string().trim().min(1).max(200),
          type: SERVICE_TYPE,
          companyId: z.string(),
          provider: PROVIDER.optional(),
          dueDate: date.nullable().optional().describe("Fecha de renovación o vencimiento"),
          price: z.number().nonnegative().nullable().optional().describe("Precio en pesos"),
          description: z.string().optional(),
          notes: z.string().optional(),
          isActive: z.boolean().optional(),
        },
        annotations: write,
      },
      async (a) => {
        const r = await crearServicio(user, {
          name: a.name,
          type: a.type,
          provider: a.provider ?? "GENIORAMA",
          description: a.description ?? null,
          dueDate: toDate(a.dueDate) ?? null,
          price: a.price ?? null,
          notes: a.notes ?? null,
          isActive: a.isActive ?? true,
          companyId: a.companyId,
        });
        if (!r.ok) return fail(r.error);
        const service = await prisma.service.findUnique({ where: { id: r.id }, select: serviceSelect });
        return ok({ service: service ? serializeService(service) : { id: r.id } });
      },
    );
  }

  // ─── Editar ────────────────────────────────────────────────────────────────

  if (canEdit) {
    server.registerTool(
      "infra_update_site",
      {
        title: "Infraestructura: editar sitio",
        description: "Cambia solo los campos que se envíen. isActive=false lo da de baja sin borrarlo.",
        inputSchema: {
          siteId: z.string(),
          name: z.string().trim().min(1).max(200).optional(),
          domain: z.string().trim().min(1).max(500).optional(),
          companyId: z.string().optional(),
          documentation: z.string().nullable().optional(),
          architecture: z.string().nullable().optional(),
          isActive: z.boolean().optional(),
        },
        annotations: write,
      },
      async ({ siteId, ...a }) => {
        const cur = await prisma.site.findUnique({
          where: { id: siteId },
          select: { name: true, domain: true, companyId: true, documentation: true, architecture: true, isActive: true },
        });
        if (!cur) return fail("Sitio no encontrado");
        const r = await actualizarSitio(user, siteId, {
          name: a.name ?? cur.name,
          domain: a.domain ?? cur.domain,
          companyId: a.companyId ?? cur.companyId,
          documentation: a.documentation !== undefined ? a.documentation : cur.documentation,
          architecture: a.architecture !== undefined ? a.architecture : cur.architecture,
          isActive: a.isActive ?? cur.isActive,
        });
        if (!r.ok) return fail(r.error);
        return ok({ site: await prisma.site.findUnique({ where: { id: siteId }, select: siteSelect }) });
      },
    );

    server.registerTool(
      "infra_update_service",
      {
        title: "Infraestructura: editar servicio",
        description:
          "Cambia solo los campos que se envíen. Para registrar una renovación, mueve dueDate a la nueva " +
          "fecha. isActive=false lo da de baja sin borrarlo.",
        inputSchema: {
          serviceId: z.string(),
          name: z.string().trim().min(1).max(200).optional(),
          type: SERVICE_TYPE.optional(),
          provider: PROVIDER.optional(),
          companyId: z.string().optional(),
          dueDate: date.nullable().optional(),
          price: z.number().nonnegative().nullable().optional(),
          description: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
          isActive: z.boolean().optional(),
        },
        annotations: write,
      },
      async ({ serviceId, ...a }) => {
        const cur = await prisma.service.findUnique({
          where: { id: serviceId },
          select: {
            name: true, type: true, provider: true, companyId: true, dueDate: true,
            price: true, description: true, notes: true, isActive: true,
          },
        });
        if (!cur) return fail("Servicio no encontrado");
        const r = await actualizarServicio(user, serviceId, {
          name: a.name ?? cur.name,
          type: a.type ?? cur.type,
          provider: a.provider ?? cur.provider,
          companyId: a.companyId ?? cur.companyId,
          dueDate: a.dueDate !== undefined ? (toDate(a.dueDate) ?? null) : cur.dueDate,
          price: a.price !== undefined ? a.price : cur.price,
          description: a.description !== undefined ? a.description : cur.description,
          notes: a.notes !== undefined ? a.notes : cur.notes,
          isActive: a.isActive ?? cur.isActive,
        });
        if (!r.ok) return fail(r.error);
        const service = await prisma.service.findUnique({ where: { id: serviceId }, select: serviceSelect });
        return ok({ service: service ? serializeService(service) : { id: serviceId } });
      },
    );
  }
}
