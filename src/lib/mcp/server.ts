/**
 * Servidor MCP de Geniorama: proyectos, tareas, tickets, comentarios y lo que
 * cuelga de cada ficha (checklists, adjuntos, bóveda vinculada, tiempo, historial).
 *
 * Cada herramienta es una puerta más a las mismas funciones de `src/lib/api`
 * que usa la API REST, así que hereda todo lo que ya hacen: la visibilidad por
 * rol, los borradores ajenos, las notas internas que no salen, los avisos y los
 * webhooks. Aquí solo se traduce entre MCP y esas funciones.
 *
 * Se construye un servidor por petición con el usuario del token. Las
 * herramientas de escritura solo existen si el token tiene `write`: lo que la
 * app no puede usar, ni lo ve.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import type { ApiUser } from "@/lib/api/respond";
import type { WriteResult } from "@/lib/api/tickets";
import { getProject, getTask, listProjects, listTasks, createTaskViaApi, updateTaskViaApi } from "@/lib/api/tasks";
import {
  activePlansOfCompany,
  getTicket,
  listTickets,
  createTicketViaApi,
  updateTicketViaApi,
} from "@/lib/api/tickets";
import { addCommentViaApi, listComments } from "@/lib/api/comments";
import {
  addChecklistItemsViaApi,
  addLinkAttachmentViaApi,
  getPanels,
  listActivityViaApi,
  updateChecklistItemViaApi,
} from "@/lib/api/panels";
import type { OAuthActor } from "@/lib/oauth/server";
import { registerCrmTools } from "@/lib/mcp/crm-tools";
import { registerBillingTools } from "@/lib/mcp/billing-tools";
import { registerInfraTools } from "@/lib/mcp/infra-tools";
import { registerAdminTools } from "@/lib/mcp/admin-tools";

const PRIORITY = z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]);
const TASK_STATUS = z.enum(["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"]);
const TICKET_STATUS = z.enum(["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"]);

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
  .describe("Fecha ISO, p. ej. 2026-10-20");

const ENTITY = z.enum(["TASK", "TICKET"]);

/** Lo que acompaña a la ficha en get_task y get_ticket. */
const PANELS_NOTE =
  " Incluye sus checklists, adjuntos (archivos y enlaces), las entradas de bóveda vinculadas que el " +
  "usuario puede ver (solo título, usuario y URL: la contraseña nunca sale de la plataforma) y el tiempo registrado.";

/** Cómo se vincula un ticket a cliente, plan y empresa, para create_ticket y update_ticket. */
const LINKS_NOTE =
  "Cliente, plan y empresa: el ticket guarda clientId y planId; su empresa es la del plan y, sin plan, la del " +
  "cliente. companyId comprueba que el cliente y el plan sean de esa empresa y, si no se indica planId, toma su " +
  "plan vigente (si hay varios pide elegir; si no hay ninguno hace falta un clientId de esa empresa). " +
  "get_company_ticket_options da los clientes y planes de una empresa.";

const page = {
  limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (1–100, por defecto 25)"),
  cursor: z.string().optional().describe("nextCursor de la respuesta anterior, para la página siguiente"),
};

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function fromWrite<T>(result: WriteResult<T>, key: string) {
  return result.ok ? ok({ [key]: result.value }) : fail(result.error);
}

/** `null` borra el campo; ausente lo deja como está; fecha → Date. */
function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  return v === null ? null : new Date(v);
}

/** "me" como atajo para el propio usuario: «mis tareas» es la pregunta más común. */
function resolveMe(user: ApiUser, id: string | undefined): string | undefined {
  return id === "me" ? user.id : id;
}

export async function buildMcpServer(actor: OAuthActor): Promise<McpServer> {
  const user: ApiUser = actor.user;
  const canWrite = actor.scopes.includes("write");
  const staff = isStaff(user.role);

  const server = new McpServer(
    { name: "geniorama", title: "Geniorama", version: "1.0.0" },
    {
      instructions:
        "Plataforma de gestión de Geniorama: proyectos con tareas (trabajo interno del equipo) y tickets " +
        "(solicitudes de soporte de los clientes). Actúas como el usuario que autorizó la conexión y ves " +
        "solo lo que él ve. Usa whoami para saber su rol. Los ids son cadenas opacas: obtenlos de las " +
        "herramientas list_* antes de leer o modificar algo. Si el usuario tiene el módulo CRM, las " +
        "herramientas crm_* gestionan cuentas, contactos, oportunidades y actividades comerciales; con el " +
        "módulo Facturación, las billing_* gestionan cobros, facturas y abonos (importes en pesos colombianos); " +
        "con Infraestructura, las infra_* gestionan sitios y servicios (dominios, hosting, SSL…) y sus vencimientos; " +
        "con Administración (nivel gestor), las admin_* gestionan empresas y planes de soporte.",
    },
  );

  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  // ─── Lectura ───────────────────────────────────────────────────────────────

  server.registerTool(
    "whoami",
    {
      title: "Quién soy",
      description: "Usuario conectado, su rol (ADMINISTRADOR, COLABORADOR o CLIENTE) y los permisos de esta conexión.",
      annotations: readOnly,
    },
    async () => ok({ user, scopes: actor.scopes, app: actor.clientName }),
  );

  server.registerTool(
    "list_projects",
    {
      title: "Listar proyectos",
      description: "Proyectos visibles para el usuario, del más reciente al más antiguo.",
      inputSchema: page,
      annotations: readOnly,
    },
    async ({ limit, cursor }) => ok(await listProjects(user, { limit: limit ?? 25, cursor: cursor ?? null })),
  );

  server.registerTool(
    "get_project",
    {
      title: "Ver proyecto",
      description: "Detalle de un proyecto por id.",
      inputSchema: { projectId: z.string() },
      annotations: readOnly,
    },
    async ({ projectId }) => {
      const project = await getProject(user, projectId);
      return project ? ok({ project }) : fail("Proyecto no encontrado");
    },
  );

  server.registerTool(
    "list_tasks",
    {
      title: "Listar tareas",
      description:
        "Tareas visibles para el usuario, de la más reciente a la más antigua. Filtra por proyecto, estado o " +
        'responsable; assignedToId="me" devuelve las del propio usuario.',
      inputSchema: {
        projectId: z.string().optional(),
        status: TASK_STATUS.optional(),
        assignedToId: z.string().optional().describe('Id de usuario, o "me"'),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ projectId, status, assignedToId, limit, cursor }) =>
      ok(
        await listTasks(user, {
          limit: limit ?? 25,
          cursor: cursor ?? null,
          projectId,
          status,
          assignedToId: resolveMe(user, assignedToId),
        }),
      ),
  );

  server.registerTool(
    "get_task",
    {
      title: "Ver tarea",
      description: "Detalle de una tarea por id." + PANELS_NOTE,
      inputSchema: { taskId: z.string() },
      annotations: readOnly,
    },
    async ({ taskId }) => {
      const task = await getTask(user, taskId);
      if (!task) return fail("Tarea no encontrada");
      // Null para el cliente al que no involucraron: ve la tarea, no su detalle
      const panels = await getPanels(user, "TASK", taskId);
      return ok({ task, ...panels });
    },
  );

  server.registerTool(
    "list_tickets",
    {
      title: "Listar tickets",
      description:
        "Tickets de soporte visibles para el usuario, del más reciente al más antiguo. " +
        'assignedToId="me" devuelve los asignados al propio usuario.',
      inputSchema: {
        status: TICKET_STATUS.optional(),
        assignedToId: z.string().optional().describe('Id de usuario, o "me"'),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ status, assignedToId, limit, cursor }) =>
      ok(
        await listTickets(user, {
          limit: limit ?? 25,
          cursor: cursor ?? null,
          status,
          assignedToId: resolveMe(user, assignedToId),
        }),
      ),
  );

  server.registerTool(
    "get_ticket",
    {
      title: "Ver ticket",
      description: "Detalle de un ticket por id." + PANELS_NOTE,
      inputSchema: { ticketId: z.string() },
      annotations: readOnly,
    },
    async ({ ticketId }) => {
      const ticket = await getTicket(user, ticketId);
      if (!ticket) return fail("Ticket no encontrado");
      const panels = await getPanels(user, "TICKET", ticketId);
      return ok({ ticket, ...panels });
    },
  );

  server.registerTool(
    "list_comments",
    {
      title: "Leer comentarios",
      description:
        "Comentarios de una tarea o un ticket, del más reciente al más antiguo, con sus adjuntos. " +
        "Las notas internas no se incluyen.",
      inputSchema: {
        entityType: ENTITY,
        entityId: z.string(),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ entityType, entityId, limit, cursor }) => {
      const result = await listComments(user, entityType, entityId, { limit: limit ?? 25, cursor: cursor ?? null });
      return result ? ok(result) : fail("No encuentro esa tarea o ticket, o no tienes acceso");
    },
  );

  // El historial y el directorio —quién trabaja aquí y con qué correo— son solo para el equipo
  if (staff) {
    server.registerTool(
      "list_activity",
      {
        title: "Ver historial",
        description:
          "Historial de una tarea o un ticket, de lo más reciente a lo más antiguo: quién cambió qué y cuándo. " +
          "`action` va como recurso.acción (p. ej. ticket.status_changed) y `changes` como { campo: { from, to } }.",
        inputSchema: { entityType: ENTITY, entityId: z.string(), ...page },
        annotations: readOnly,
      },
      async ({ entityType, entityId, limit, cursor }) => {
        const result = await listActivityViaApi(user, entityType, entityId, { limit: limit ?? 25, cursor: cursor ?? null });
        return result ? ok(result) : fail("No encuentro esa tarea o ticket, o no tienes acceso");
      },
    );

    server.registerTool(
      "list_companies",
      {
        title: "Buscar empresas",
        description:
          "Empresas activas (clientes) por nombre, para obtener el companyId que piden las herramientas de " +
          "facturación, infraestructura y CRM.",
        inputSchema: { search: z.string().optional().describe("Parte del nombre"), limit: page.limit },
        annotations: readOnly,
      },
      async ({ search, limit }) => {
        const q = search?.trim();
        const companies = await prisma.company.findMany({
          where: { isActive: true, ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}) },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
          take: limit ?? 25,
        });
        return ok({ companies });
      },
    );

    server.registerTool(
      "get_company_ticket_options",
      {
        title: "Clientes y planes de una empresa",
        description:
          "Los usuarios cliente activos de una empresa y sus planes, para elegir el clientId y el planId de un ticket. " +
          "`vigente` dice si contra ese plan se puede abrir trabajo hoy (activo, sin vencer y con horas).",
        inputSchema: { companyId: z.string() },
        annotations: readOnly,
      },
      async ({ companyId }) => {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            id: true,
            name: true,
            users: {
              where: { role: "CLIENTE", isActive: true },
              select: { id: true, name: true, email: true },
              orderBy: { name: "asc" },
            },
            plans: {
              where: { isActive: true },
              select: { id: true, name: true, type: true },
              orderBy: { startedAt: "desc" },
            },
          },
        });
        if (!company) return fail("Empresa no encontrada");
        const vigentes = new Set((await activePlansOfCompany(companyId)).map((p) => p.id));
        return ok({
          company: { id: company.id, name: company.name },
          clients: company.users,
          plans: company.plans.map((p) => ({ ...p, vigente: vigentes.has(p.id) })),
        });
      },
    );

    server.registerTool(
      "find_users",
      {
        title: "Buscar usuarios",
        description:
          "Busca usuarios activos por nombre o correo, para obtener el id con el que asignar trabajo o " +
          "mencionar a alguien. Cada resultado trae `mention`, el texto exacto para mencionarlo en un comentario.",
        inputSchema: {
          query: z.string().optional().describe("Parte del nombre o del correo"),
          role: z.enum(["ADMINISTRADOR", "COLABORADOR", "CLIENTE"]).optional(),
          limit: page.limit,
        },
        annotations: readOnly,
      },
      async ({ query, role, limit }) => {
        const q = query?.trim();
        const users = await prisma.user.findMany({
          where: {
            isActive: true,
            ...(role ? { role } : {}),
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" as const } },
                    { email: { contains: q, mode: "insensitive" as const } },
                  ],
                }
              : {}),
          },
          select: { id: true, name: true, email: true, role: true, cargo: true },
          orderBy: { name: "asc" },
          take: limit ?? 25,
        });
        // La mención lista para pegar: el agente no tiene que adivinar el formato
        return ok({ users: users.map((u) => ({ ...u, mention: `@[${u.name}](${u.id})` })) });
      },
    );
  }

  // CRM, Facturación, Infraestructura y Administración: solo si el usuario tiene cada módulo (ver *-tools)
  await registerCrmTools(server, user, canWrite);
  await registerBillingTools(server, user, canWrite);
  await registerInfraTools(server, user, canWrite);
  await registerAdminTools(server, user, canWrite);

  if (!canWrite) return server;

  // ─── Escritura ─────────────────────────────────────────────────────────────

  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
  const source = `${actor.clientName} (MCP)`;

  if (staff) {
    server.registerTool(
      "create_task",
      {
        title: "Crear tarea",
        description: "Crea una tarea en un proyecto. Notifica al responsable como cualquier tarea nueva.",
        inputSchema: {
          projectId: z.string(),
          title: z.string().trim().min(1).max(200),
          description: z.string().trim().min(1).describe("Markdown"),
          priority: PRIORITY.optional(),
          category: z.string().trim().max(80).optional(),
          assignedToId: z.string().optional().describe('Id de usuario del equipo, o "me"'),
          startDate: date.optional(),
          dueDate: date.optional(),
          estimatedHours: z.number().positive().max(1000).optional(),
        },
        annotations: write,
      },
      async (args) => {
        const result = await createTaskViaApi(user, {
          projectId: args.projectId,
          title: args.title,
          description: args.description,
          priority: args.priority,
          category: args.category ?? null,
          assignedToId: resolveMe(user, args.assignedToId) ?? null,
          startDate: toDate(args.startDate) ?? null,
          dueDate: toDate(args.dueDate) ?? null,
          estimatedHours: args.estimatedHours ?? null,
        });
        return fromWrite(result, "task");
      },
    );

    server.registerTool(
      "update_task",
      {
        title: "Actualizar tarea",
        description: "Cambia solo los campos que se envíen. null borra responsable, categoría, fechas o estimación.",
        inputSchema: {
          taskId: z.string(),
          title: z.string().trim().min(1).max(200).optional(),
          description: z.string().trim().min(1).optional(),
          status: TASK_STATUS.optional(),
          priority: PRIORITY.optional(),
          category: z.string().trim().max(80).nullable().optional(),
          assignedToId: z.string().nullable().optional().describe('Id de usuario del equipo, "me" o null'),
          startDate: date.nullable().optional(),
          dueDate: date.nullable().optional(),
          estimatedHours: z.number().positive().max(1000).nullable().optional(),
        },
        annotations: write,
      },
      async ({ taskId, startDate, dueDate, assignedToId, ...rest }) => {
        const result = await updateTaskViaApi(user, taskId, {
          ...rest,
          ...(assignedToId !== undefined ? { assignedToId: assignedToId === null ? null : resolveMe(user, assignedToId) } : {}),
          ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}),
          ...(dueDate !== undefined ? { dueDate: toDate(dueDate) } : {}),
        });
        return fromWrite(result, "task");
      },
    );

    server.registerTool(
      "update_ticket",
      {
        title: "Actualizar ticket",
        description:
          "Cambia solo los campos que se envíen: estado, prioridad, responsable, fecha, cliente, plan… null borra el campo. " +
          LINKS_NOTE,
        inputSchema: {
          ticketId: z.string(),
          clientId: z.string().nullable().optional().describe("Id de un usuario CLIENTE, o null para quitarlo"),
          planId: z.string().nullable().optional().describe("Id de un plan, o null para quitarlo"),
          companyId: z.string().optional().describe("Id de empresa, de list_companies"),
          title: z.string().trim().min(1).max(200).optional(),
          description: z.string().trim().min(1).optional(),
          status: TICKET_STATUS.optional(),
          priority: PRIORITY.optional(),
          category: z.string().trim().max(80).nullable().optional(),
          assignedToId: z.string().nullable().optional().describe('Id de usuario del equipo, "me" o null'),
          dueDate: date.nullable().optional(),
        },
        annotations: write,
      },
      async ({ ticketId, dueDate, assignedToId, ...rest }) => {
        const result = await updateTicketViaApi(user, ticketId, {
          ...rest,
          ...(assignedToId !== undefined ? { assignedToId: assignedToId === null ? null : resolveMe(user, assignedToId) } : {}),
          ...(dueDate !== undefined ? { dueDate: toDate(dueDate) } : {}),
        });
        return fromWrite(result, "ticket");
      },
    );

    server.registerTool(
      "add_link_attachment",
      {
        title: "Adjuntar enlace",
        description:
          "Añade un enlace a los adjuntos de una tarea o un ticket. Solo enlaces: los archivos se suben desde la plataforma.",
        inputSchema: {
          entityType: ENTITY,
          entityId: z.string(),
          url: z.string().trim().url().describe("http:// o https://"),
          label: z.string().trim().max(200).optional().describe("Nombre visible; sin él se muestra la URL"),
        },
        annotations: write,
      },
      async ({ entityType, entityId, url, label }) =>
        fromWrite(await addLinkAttachmentViaApi(user, entityType, entityId, { url, label }), "attachments"),
    );
  }

  server.registerTool(
    "create_ticket",
    {
      title: "Crear ticket",
      description: staff
        ? "Crea un ticket de soporte. Sin status nace POR_ASIGNAR. " + LINKS_NOTE
        : "Abre un ticket de soporte a tu nombre. Requiere un plan vigente.",
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        description: z.string().trim().min(1).describe("Markdown"),
        priority: PRIORITY.optional(),
        category: z.string().trim().max(80).optional(),
        ...(staff
          ? {
              status: TICKET_STATUS.optional(),
              assignedToId: z.string().optional().describe('Id de usuario del equipo, o "me"'),
              clientId: z.string().optional().describe("Id de un usuario CLIENTE"),
              planId: z.string().optional().describe("Id de un plan"),
              companyId: z.string().optional().describe("Id de empresa, de list_companies"),
            }
          : {}),
        dueDate: date.optional(),
      },
      annotations: write,
    },
    async (args) => {
      const a = args as typeof args & {
        status?: z.infer<typeof TICKET_STATUS>;
        assignedToId?: string;
        clientId?: string;
        planId?: string;
        companyId?: string;
      };
      const result = await createTicketViaApi(user, source, {
        title: a.title,
        description: a.description,
        priority: a.priority,
        status: a.status,
        category: a.category ?? null,
        assignedToId: resolveMe(user, a.assignedToId) ?? null,
        dueDate: toDate(a.dueDate) ?? null,
        clientId: a.clientId,
        planId: a.planId,
        companyId: a.companyId,
      });
      return fromWrite(result, "ticket");
    },
  );

  server.registerTool(
    "add_checklist_items",
    {
      title: "Añadir al checklist",
      description:
        "Añade ítems al checklist de una tarea o un ticket. Con checklistId van a ese checklist; con " +
        "newChecklistTitle se crea uno nuevo y van ahí; sin ninguno, al primero de la ficha (se crea si no hay). " +
        "Devuelve los checklists como quedan.",
      inputSchema: {
        entityType: ENTITY,
        entityId: z.string(),
        checklistId: z.string().optional().describe("Id de un checklist de get_task / get_ticket"),
        newChecklistTitle: z.string().trim().min(1).max(200).optional(),
        items: z.array(z.string().trim().min(1).max(500)).max(100).optional().describe("Un texto por ítem"),
      },
      annotations: write,
    },
    async ({ entityType, entityId, checklistId, newChecklistTitle, items }) =>
      fromWrite(
        await addChecklistItemsViaApi(user, entityType, entityId, { checklistId, newChecklistTitle, items: items ?? [] }),
        "checklists",
      ),
  );

  server.registerTool(
    "update_checklist_item",
    {
      title: "Marcar o editar un ítem",
      description:
        "Marca o desmarca un ítem de checklist, o le cambia el texto. `checked` fija el estado, no lo invierte. " +
        "Devuelve los checklists como quedan.",
      inputSchema: {
        entityType: ENTITY,
        entityId: z.string(),
        itemId: z.string().describe("Id del ítem, de get_task / get_ticket"),
        checked: z.boolean().optional(),
        title: z.string().trim().min(1).max(500).optional(),
      },
      annotations: { ...write, idempotentHint: true },
    },
    async ({ entityType, entityId, itemId, checked, title }) =>
      fromWrite(
        await updateChecklistItemViaApi(user, entityType, entityId, itemId, { checked, title }),
        "checklists",
      ),
  );

  server.registerTool(
    "add_comment",
    {
      title: "Comentar",
      description:
        "Publica un comentario visible en una tarea o un ticket. Avisa al creador y al responsable. " +
        "Para mencionar a alguien (le llega un aviso y un correo) escribe @[Nombre](userId) con " +
        "su id real; el campo `mention` de find_users ya viene en ese formato. Un «@Nombre» en texto plano " +
        "no es una mención y no avisa a nadie.",
      inputSchema: {
        entityType: ENTITY,
        entityId: z.string(),
        body: z.string().trim().min(1).max(10000).describe(
          "Markdown: negritas, listas, citas, código, tablas y enlaces. Menciones: @[Nombre](userId)",
        ),
      },
      annotations: write,
    },
    async ({ entityType, entityId, body }) =>
      fromWrite(await addCommentViaApi(user, entityType, entityId, body), "comment"),
  );

  return server;
}
