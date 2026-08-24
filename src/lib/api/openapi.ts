/**
 * Especificación OpenAPI de la API pública.
 *
 * Vive en código y no en un `.yaml` suelto por una razón concreta: los enums
 * —permisos de las llaves, estados, prioridades— se importan de donde ya están
 * definidos, así que no pueden quedarse desfasados respecto a lo que el
 * servidor acepta de verdad. Un YAML a mano se desincroniza el primer día.
 *
 * Se sirve en `GET /api/v1/openapi.json` (sin llave: no contiene secretos) y la
 * pantalla `/admin/integraciones/api/referencia` la pinta con Swagger UI.
 *
 * **Por qué 3.0.3 y no 3.1.** Por compatibilidad con las herramientas que van a
 * consumirla: Postman, Insomnia, los nodos de n8n y los generadores de clientes
 * leen 3.0 sin reservas, mientras que el soporte de 3.1 sigue siendo desigual.
 * La única diferencia que se nota al escribirla es que los campos anulables usan
 * `nullable: true` en vez de `type: [..., "null"]`.
 */

import { API_SCOPES } from "@/lib/api/scopes";

const TICKET_STATUS = ["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"];
const TASK_STATUS = ["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"];
const PRIORITY = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

// ─── Piezas reutilizadas ─────────────────────────────────────────────────────

const person = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    email: { type: "string", format: "email" },
  },
} as const;

const ticketSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "cmt1nrcaf000021uultlt2dm4" },
    code: { type: "string", description: "Código legible: prefijo de la empresa más consecutivo.", example: "ACM-42" },
    title: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: TICKET_STATUS },
    priority: { type: "string", enum: PRIORITY },
    category: { type: "string", nullable: true },
    isDraft: { type: "boolean" },
    dueDate: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri", description: "Enlace al ticket dentro de la plataforma." },
    createdBy: person,
    assignedTo: person,
    client: person,
    plan: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" } },
    },
    site: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" }, domain: { type: "string" } },
    },
  },
} as const;

const taskSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    code: { type: "string", nullable: true, description: "Prefijo del proyecto más consecutivo. Null si la tarea no tiene proyecto.", example: "SWG-3" },
    title: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: TASK_STATUS },
    priority: { type: "string", enum: PRIORITY },
    category: { type: "string", nullable: true },
    isDraft: { type: "boolean" },
    externalRef: { type: "string", nullable: true },
    startDate: { type: "string", format: "date-time", nullable: true },
    startTime: { type: "string", nullable: true, example: "09:00" },
    dueDate: { type: "string", format: "date-time", nullable: true },
    endTime: { type: "string", nullable: true, example: "18:00" },
    estimatedHours: { type: "number", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    project: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" } },
    },
    createdBy: person,
    assignedTo: person,
  },
} as const;

const projectSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: ["PLANIFICACION", "EN_DESARROLLO", "EN_REVISION", "COMPLETADO", "PAUSADO"] },
    isActive: { type: "boolean" },
    isPrivate: { type: "boolean" },
    startDate: { type: "string", format: "date-time", nullable: true },
    dueDate: { type: "string", format: "date-time", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    company: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" } },
    },
    manager: person,
    createdBy: person,
  },
} as const;

const commentSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    body: { type: "string" },
    isInternal: { type: "boolean", description: "Siempre false: las notas internas no salen ni entran por la API." },
    createdAt: { type: "string", format: "date-time" },
    author: person,
  },
} as const;

// ─── CRM ─────────────────────────────────────────────────────────────────────

const ACCOUNT_STAGE = ["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"];
const DEAL_STAGE = ["NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA"];
const ACTIVITY_TYPE = ["NOTA", "LLAMADA", "CORREO", "REUNION", "WHATSAPP"];

/** Cómo viaja una cuenta cuando es la referencia de otra cosa, no el sujeto. */
const accountRef = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    stage: { type: "string", enum: ACCOUNT_STAGE },
  },
} as const;

const accountSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    stage: {
      type: "string",
      enum: ACCOUNT_STAGE,
      description:
        "Etapa del ciclo de vida. Solo las `CLIENTE` aparecen donde se elige «la empresa» de un proyecto, un plan o un sitio.",
    },
    source: { type: "string", nullable: true, description: "De dónde salió: referido, web, evento…" },
    taxId: { type: "string", nullable: true },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    owner: person,
    contactCount: { type: "integer" },
    dealCount: { type: "integer" },
  },
} as const;

const contactSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: {
      type: "string",
      description: "Nombre y apellidos juntos. Se compone; el dato vive separado.",
    },
    firstName: { type: "string" },
    lastName: { type: "string", nullable: true },
    email: { type: "string", format: "email" },
    phone: {
      type: "string", nullable: true,
      description: "Siempre en E.164 (`+573001234567`), listo para usar en una campaña.",
      example: "+573001234567",
    },
    position: { type: "string", nullable: true },
    isPrimary: { type: "boolean", description: "Solo uno por cuenta: marcar otro desmarca el anterior." },
    isActive: { type: "boolean" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    account: accountRef,
  },
} as const;

const dealSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    stage: { type: "string", enum: DEAL_STAGE },
    amount: { type: "number", nullable: true, description: "Valor estimado, en la moneda de la agencia." },
    notes: { type: "string", nullable: true },
    expectedCloseAt: { type: "string", format: "date-time", nullable: true },
    closedAt: {
      type: "string", format: "date-time", nullable: true,
      description: "Se sella al pasar a GANADA o PERDIDA, y vuelve a null si se reabre.",
    },
    lostReason: { type: "string", nullable: true },
    isOpen: {
      type: "boolean",
      description: "Si sigue viva. Evita tener que saberse de memoria qué etapas son terminales.",
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    account: accountRef,
    owner: person,
    contact: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string", nullable: true } },
    },
    createdBy: person,
  },
} as const;

const activitySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    type: { type: "string", enum: ACTIVITY_TYPE },
    summary: { type: "string", description: "Qué pasó, en una línea." },
    notes: { type: "string", nullable: true },
    occurredAt: {
      type: "string", format: "date-time",
      description: "Cuándo ocurrió de verdad, que no es cuándo se apuntó.",
    },
    createdAt: { type: "string", format: "date-time" },
    url: { type: "string", format: "uri" },
    account: accountRef,
    deal: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, title: { type: "string" }, stage: { type: "string", enum: DEAL_STAGE } },
    },
    contact: {
      type: "object",
      nullable: true,
      properties: { id: { type: "string" }, name: { type: "string" }, email: { type: "string", nullable: true } },
    },
    createdBy: person,
  },
} as const;

const errorSchema = {
  type: "object",
  properties: {
    ok: { type: "boolean", enum: [false] },
    error: { type: "string" },
    issues: {
      type: "array",
      description: "Detalle de validación cuando el cuerpo no cuadra (solo en 400).",
      items: { type: "object" },
    },
  },
  required: ["ok", "error"],
} as const;

const errorRef = { $ref: "#/components/schemas/Error" } as const;

/** Descripción compartida por el campo que atribuye la escritura a otra persona. */
const ON_BEHALF_OF = {
  type: "string",
  description:
    "Id o correo del usuario al que se atribuye lo creado. Exige el permiso `act_as` y una llave del equipo; " +
    "no se permite suplantar a un administrador. Sin este campo, el autor es el usuario dueño de la llave.",
  example: "cliente@empresa.com",
} as const;

const paginationParams = [
  {
    name: "limit",
    in: "query",
    description: "Cuántos elementos devolver. Máximo 100.",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
  },
  {
    name: "cursor",
    in: "query",
    description: "El `nextCursor` de la página anterior.",
    schema: { type: "string" },
  },
] as const;

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
} as const;

/** Respuestas de error que puede dar cualquier endpoint autenticado. */
function commonErrors(extra: Record<string, unknown> = {}) {
  return {
    "400": {
      description: "El cuerpo no valida. `issues` trae el detalle campo a campo.",
      content: { "application/json": { schema: errorRef } },
    },
    "401": {
      description: "Sin cabecera `Authorization`, token mal formado, llave inválida, revocada o vencida.",
      content: { "application/json": { schema: errorRef } },
    },
    "403": {
      description: "A la llave le falta el permiso necesario, o el rol del autor no puede hacerlo.",
      content: { "application/json": { schema: errorRef } },
    },
    ...extra,
  };
}

function notFound(what: string) {
  return {
    "404": {
      description: `${what} no existe, o queda fuera de lo que esa llave puede ver.`,
      content: { "application/json": { schema: errorRef } },
    },
  };
}

function okWith(name: string, schema: unknown, extra: Record<string, unknown> = {}) {
  return {
    description: "Correcto.",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: { ok: { type: "boolean", enum: [true] }, [name]: schema, ...extra },
        },
      },
    },
  };
}

// ─── Documento ───────────────────────────────────────────────────────────────

/**
 * @param baseUrl De dónde cuelga la API. Se pasa en tiempo de ejecución para que
 *   el botón «Try it out» apunte al servidor que está sirviendo la página y no a
 *   una URL escrita a mano que se quedaría vieja.
 */
export function buildOpenApiDocument(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "API de Geniorama Tickets",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
      description: [
        "API para leer y escribir tickets, tareas, proyectos, comentarios y el CRM desde fuera de la plataforma.",
        "",
        "**Autenticación.** Toda llamada lleva `Authorization: Bearer gnr_…`. Las llaves se crean en",
        "Administración → Integraciones del equipo, y cada una **escribe en nombre de un usuario**: ve",
        "exactamente lo que esa persona vería en la plataforma y lo que crea queda con su autoría.",
        "",
        "**Permisos.** `read` para consultar, `write` para crear y actualizar, `act_as` para usar",
        "`onBehalfOf` y atribuir lo creado a otra persona.",
        "",
        "**Lo que la API no hace.** No crea proyectos ni usuarios, no escribe notas internas y no deja a",
        "un cliente asignar ni cerrar. Son las mismas fronteras que aplica la interfaz.",
        "",
        "**CRM.** Los endpoints de `/accounts` y `/deals` exigen además que el dueño de la llave tenga el",
        "módulo CRM concedido: `read` necesita nivel Lectura, `write` necesita Miembro. Si a esa persona se",
        "le retira el módulo, sus llaves dejan de leer el CRM en la siguiente llamada, sin revocarlas.",
        "",
        "Para recibir avisos en sentido contrario —que la plataforma te cuente lo que pasa— se usan los",
        "hooks, que se configuran en esa misma pantalla.",
      ].join("\n"),
    },
    servers: [{ url: `${baseUrl}/api/v1`, description: "Esta instalación" }],
    tags: [
      { name: "Diagnóstico", description: "Comprobar la llave y descubrir el catálogo de eventos." },
      { name: "Tickets", description: "Soporte. Un ticket cuelga de un plan y de un sitio, no de un proyecto." },
      { name: "Tareas", description: "Trabajo dentro de un proyecto." },
      { name: "Proyectos", description: "Solo lectura." },
      { name: "Usuarios", description: "Directorio mínimo, para resolver responsables y `onBehalfOf`." },
      { name: "CRM · Cuentas", description: "Empresas y prospectos, con sus contactos y su historial." },
      { name: "CRM · Oportunidades", description: "El pipeline de venta." },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `Token completo de la llave, incluido el prefijo \`gnr_\`. Permisos disponibles: ${API_SCOPES.join(", ")}.`,
        },
      },
      schemas: {
        Ticket: ticketSchema,
        Task: taskSchema,
        Project: projectSchema,
        Comment: commentSchema,
        Account: accountSchema,
        Contact: contactSchema,
        Deal: dealSchema,
        Activity: activitySchema,
        Error: errorSchema,
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      // ── Diagnóstico ──
      "/me": {
        get: {
          operationId: "getMe",
          tags: ["Diagnóstico"],
          summary: "Comprobar la llave",
          description:
            "El primer endpoint que conviene llamar al integrar: dice si el token vale, en nombre de quién escribe y qué permisos tiene. No exige ningún permiso concreto.",
          responses: {
            "200": okWith("key", {
              type: "object",
              properties: {
                id: { type: "string" },
                label: { type: "string" },
                scopes: { type: "array", items: { type: "string", enum: [...API_SCOPES] } },
              },
            }, {
              user: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string", enum: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
                },
              },
            }),
            "401": {
              description: "Token ausente, mal formado, inválido, revocado o vencido.",
              content: { "application/json": { schema: errorRef } },
            },
          },
        },
      },

      "/events": {
        get: {
          operationId: "listHookEvents",
          tags: ["Diagnóstico"],
          summary: "Catálogo de eventos de los hooks",
          description:
            "Los eventos a los que puede suscribirse un hook. Se expone por API para que un workflow pueda comprobar contra qué está escrito sin copiar la lista a mano. Requiere `read`.",
          responses: {
            "200": okWith("events", {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", example: "ticket.status_changed" },
                  resource: { type: "string", enum: ["ticket", "task", "project", "comment", "account", "contact", "deal", "activity"] },
                  label: { type: "string" },
                  description: { type: "string" },
                },
              },
            }),
            ...commonErrors(),
          },
        },
      },

      // ── Tickets ──
      "/tickets": {
        get: {
          operationId: "listTickets",
          tags: ["Tickets"],
          summary: "Listar tickets",
          description:
            "Devuelve los tickets que la llave puede ver. Una llave del equipo los ve todos (menos borradores ajenos); una de cliente, los suyos y los de sus empresas. Requiere `read`.",
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: TICKET_STATUS } },
            { name: "assignedToId", in: "query", schema: { type: "string" } },
            ...paginationParams,
          ],
          responses: {
            "200": okWith("tickets", { type: "array", items: { $ref: "#/components/schemas/Ticket" } }, {
              nextCursor: { type: "string", nullable: true, description: "Null cuando no quedan más páginas." },
            }),
            ...commonErrors(),
          },
        },
        post: {
          operationId: "createTicket",
          tags: ["Tickets"],
          summary: "Crear un ticket",
          description: [
            "Requiere `write`.",
            "",
            "**Estado.** Sin `status`, el ticket nace `POR_ASIGNAR`: lo que entra por una integración",
            "todavía no tiene dueño y pasa por la misma bandeja de triaje que el resto.",
            "",
            "**Autoría.** Con `onBehalfOf` el ticket queda a nombre de otra persona, con el prefijo de su",
            "empresa y contra su plan activo — es lo que necesita un bot que atiende a varios clientes.",
            "",
            "**Freno de negocio.** Si el autor resultante es un cliente sin plan vigente, la respuesta es",
            "un `422` con el motivo, y ese cliente no puede elegir estado ni responsable.",
          ].join("\n"),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "description"],
                  properties: {
                    title: { type: "string", maxLength: 200, example: "Se cayó la web" },
                    description: { type: "string", example: "El sitio devuelve 502 desde las 9am." },
                    priority: { type: "string", enum: PRIORITY, default: "MEDIA" },
                    status: {
                      type: "string",
                      enum: TICKET_STATUS,
                      default: "POR_ASIGNAR",
                      description: "Solo llaves del equipo. Un cliente que mande otro valor recibe 403.",
                    },
                    category: { type: "string", maxLength: 80 },
                    assignedToId: { type: "string", description: "Solo llaves del equipo." },
                    siteId: { type: "string" },
                    dueDate: { type: "string", description: "Cualquier fecha que `Date` sepa leer. Se ignora si el autor es cliente." },
                    onBehalfOf: ON_BEHALF_OF,
                  },
                },
                examples: {
                  minimo: {
                    summary: "Lo mínimo",
                    value: { title: "Se cayó la web", description: "El sitio devuelve 502 desde las 9am." },
                  },
                  enNombreDeUnCliente: {
                    summary: "En nombre de un cliente (bot de WhatsApp)",
                    value: {
                      title: "Se cayó la web",
                      description: "El sitio devuelve 502 desde las 9am.",
                      priority: "ALTA",
                      onBehalfOf: "cliente@empresa.com",
                    },
                  },
                  conEstado: {
                    summary: "Con estado explícito",
                    value: {
                      title: "Revisión mensual del hosting",
                      description: "Programada.",
                      status: "EN_PROGRESO",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("ticket", { $ref: "#/components/schemas/Ticket" }),
            ...commonErrors({
              "422": {
                description: "El cliente al que se atribuye el ticket no tiene un plan activo.",
                content: { "application/json": { schema: errorRef } },
              },
            }),
            ...notFound("El responsable o el usuario de `onBehalfOf`"),
          },
        },
      },

      "/tickets/{id}": {
        get: {
          operationId: "getTicket",
          tags: ["Tickets"],
          summary: "Ver un ticket",
          description: "Requiere `read`.",
          parameters: [idParam],
          responses: {
            "200": okWith("ticket", { $ref: "#/components/schemas/Ticket" }),
            ...commonErrors(),
            ...notFound("El ticket"),
          },
        },
        patch: {
          operationId: "updateTicket",
          tags: ["Tickets"],
          summary: "Actualizar un ticket",
          description: [
            "Requiere `write` y una llave del equipo: un cliente que puede leer un ticket no puede",
            "reasignarlo ni cerrarlo, igual que en la interfaz.",
            "",
            "Solo se tocan los campos que se manden. Omitir uno lo deja como estaba; mandarlo en `null`",
            "lo borra. Cambiar estado o responsable dispara los avisos y los hooks correspondientes.",
          ].join("\n"),
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string" },
                    status: { type: "string", enum: TICKET_STATUS },
                    priority: { type: "string", enum: PRIORITY },
                    category: { type: "string", maxLength: 80, nullable: true },
                    assignedToId: { type: "string", nullable: true },
                    dueDate: { type: "string", nullable: true },
                  },
                },
                examples: {
                  cerrar: { summary: "Cerrar el ticket", value: { status: "CERRADO" } },
                  reasignar: { summary: "Cambiar responsable", value: { assignedToId: "cku…" } },
                  quitarFecha: { summary: "Quitar la fecha límite", value: { dueDate: null } },
                },
              },
            },
          },
          responses: {
            "200": okWith("ticket", { $ref: "#/components/schemas/Ticket" }),
            ...commonErrors(),
            ...notFound("El ticket o el responsable"),
          },
        },
      },

      "/tickets/{id}/comments": {
        get: {
          operationId: "listTicketComments",
          tags: ["Tickets"],
          summary: "Listar comentarios de un ticket",
          description: "Las notas internas del equipo no se listan. Requiere `read`.",
          parameters: [idParam, ...paginationParams],
          responses: {
            "200": okWith("comments", { type: "array", items: { $ref: "#/components/schemas/Comment" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
            ...notFound("El ticket"),
          },
        },
        post: {
          operationId: "createTicketComment",
          tags: ["Tickets"],
          summary: "Comentar un ticket",
          description: "El comentario nunca es interno: lo ve todo el hilo. Requiere `write`.",
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: {
                    body: { type: "string", maxLength: 10000 },
                    onBehalfOf: ON_BEHALF_OF,
                  },
                },
                examples: {
                  basico: { summary: "Comentar", value: { body: "Ya quedó desplegado, ¿lo revisas?" } },
                  comoCliente: {
                    summary: "En nombre del cliente",
                    value: { body: "Sigue fallando desde mi celular.", onBehalfOf: "cliente@empresa.com" },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("comment", { $ref: "#/components/schemas/Comment" }),
            ...commonErrors(),
            ...notFound("El ticket"),
          },
        },
      },

      // ── Tareas ──
      "/tasks": {
        get: {
          operationId: "listTasks",
          tags: ["Tareas"],
          summary: "Listar tareas",
          description:
            "Una llave del equipo ve todas (menos borradores ajenos); una de cliente, las de los proyectos de sus empresas. Requiere `read`.",
          parameters: [
            { name: "projectId", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: TASK_STATUS } },
            { name: "assignedToId", in: "query", schema: { type: "string" } },
            ...paginationParams,
          ],
          responses: {
            "200": okWith("tasks", { type: "array", items: { $ref: "#/components/schemas/Task" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
          },
        },
        post: {
          operationId: "createTask",
          tags: ["Tareas"],
          summary: "Crear una tarea",
          description: [
            "Requiere `write` y una llave del equipo: crear tareas no es algo que haga un cliente.",
            "",
            "**`externalRef` la hace idempotente.** Si el workflow reintenta, la segunda llamada devuelve",
            "la tarea que ya creó con `duplicate: true` y un `200` en vez de un `201`. Mándalo siempre que",
            "tu origen tenga un identificador propio.",
          ].join("\n"),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["projectId", "title", "description"],
                  properties: {
                    projectId: { type: "string" },
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string" },
                    priority: { type: "string", enum: PRIORITY, default: "MEDIA" },
                    category: { type: "string", maxLength: 80 },
                    assignedToId: { type: "string" },
                    startDate: { type: "string" },
                    dueDate: { type: "string" },
                    estimatedHours: { type: "number", minimum: 0, maximum: 1000 },
                    externalRef: { type: "string", maxLength: 191 },
                    onBehalfOf: ON_BEHALF_OF,
                  },
                },
                examples: {
                  idempotente: {
                    summary: "Con referencia externa",
                    value: {
                      projectId: "ckp…",
                      title: "Publicar el post de agosto",
                      description: "Sale del calendario de contenidos.",
                      externalRef: "n8n-exec-1234",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("task", { $ref: "#/components/schemas/Task" }, {
              duplicate: { type: "boolean", description: "true si `externalRef` ya existía y se devolvió la tarea previa (con código 200)." },
            }),
            ...commonErrors(),
            ...notFound("El proyecto o el responsable"),
          },
        },
      },

      "/tasks/{id}": {
        get: {
          operationId: "getTask",
          tags: ["Tareas"],
          summary: "Ver una tarea",
          description: "Requiere `read`.",
          parameters: [idParam],
          responses: {
            "200": okWith("task", { $ref: "#/components/schemas/Task" }),
            ...commonErrors(),
            ...notFound("La tarea"),
          },
        },
        patch: {
          operationId: "updateTask",
          tags: ["Tareas"],
          summary: "Actualizar una tarea",
          description:
            "Requiere `write` y una llave del equipo. Solo se tocan los campos enviados; `null` borra el valor. Pasar a `COMPLETADO` avisa a quien la creó y a quien la tiene asignada.",
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 200 },
                    description: { type: "string" },
                    status: { type: "string", enum: TASK_STATUS },
                    priority: { type: "string", enum: PRIORITY },
                    category: { type: "string", maxLength: 80, nullable: true },
                    assignedToId: { type: "string", nullable: true },
                    startDate: { type: "string", nullable: true },
                    dueDate: { type: "string", nullable: true },
                    estimatedHours: { type: "number", nullable: true },
                  },
                },
                examples: {
                  completar: { summary: "Marcarla completada", value: { status: "COMPLETADO" } },
                },
              },
            },
          },
          responses: {
            "200": okWith("task", { $ref: "#/components/schemas/Task" }),
            ...commonErrors(),
            ...notFound("La tarea o el responsable"),
          },
        },
      },

      "/tasks/{id}/comments": {
        get: {
          operationId: "listTaskComments",
          tags: ["Tareas"],
          summary: "Listar comentarios de una tarea",
          description: "Requiere `read`.",
          parameters: [idParam, ...paginationParams],
          responses: {
            "200": okWith("comments", { type: "array", items: { $ref: "#/components/schemas/Comment" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
            ...notFound("La tarea"),
          },
        },
        post: {
          operationId: "createTaskComment",
          tags: ["Tareas"],
          summary: "Comentar una tarea",
          description: "Requiere `write`.",
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["body"],
                  properties: {
                    body: { type: "string", maxLength: 10000 },
                    onBehalfOf: ON_BEHALF_OF,
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("comment", { $ref: "#/components/schemas/Comment" }),
            ...commonErrors(),
            ...notFound("La tarea"),
          },
        },
      },

      // ── Proyectos ──
      "/projects": {
        get: {
          operationId: "listProjects",
          tags: ["Proyectos"],
          summary: "Listar proyectos",
          description:
            "Los proyectos privados solo los ve quien está dentro. Requiere `read`. No hay endpoint de creación: un proyecto se crea en la plataforma, con su empresa y sus miembros.",
          parameters: [...paginationParams],
          responses: {
            "200": okWith("projects", { type: "array", items: { $ref: "#/components/schemas/Project" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
          },
        },
      },

      "/projects/{id}": {
        get: {
          operationId: "getProject",
          tags: ["Proyectos"],
          summary: "Ver un proyecto",
          description: "Requiere `read`.",
          parameters: [idParam],
          responses: {
            "200": okWith("project", { $ref: "#/components/schemas/Project" }),
            ...commonErrors(),
            ...notFound("El proyecto"),
          },
        },
      },

      // ── Usuarios ──
      "/users": {
        get: {
          operationId: "listUsers",
          tags: ["Usuarios"],
          summary: "Buscar usuarios",
          description:
            "Directorio mínimo para resolver responsables y valores de `onBehalfOf`. Reservado a llaves de una cuenta del equipo: quién trabaja aquí y con qué correo no sale por la llave de un cliente. Requiere `read`.",
          parameters: [
            { name: "q", in: "query", description: "Busca por nombre o correo, sin distinguir mayúsculas.", schema: { type: "string" } },
            paginationParams[0],
          ],
          responses: {
            "200": okWith("users", {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                  email: { type: "string" },
                  role: { type: "string", enum: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
                  cargo: { type: "string", nullable: true },
                },
              },
            }),
            ...commonErrors(),
          },
        },
      },

      // ── CRM · Cuentas ──
      "/accounts": {
        get: {
          operationId: "listAccounts",
          tags: ["CRM · Cuentas"],
          summary: "Listar cuentas",
          description: "Empresas y prospectos. Requiere `read` y nivel Lectura en el CRM.",
          parameters: [
            {
              name: "stage",
              in: "query",
              description: "Filtra por etapa del ciclo de vida.",
              schema: { type: "string", enum: ACCOUNT_STAGE },
            },
            { name: "search", in: "query", description: "Busca por nombre, sin distinguir mayúsculas.", schema: { type: "string" } },
            ...paginationParams,
          ],
          responses: {
            "200": okWith("accounts", { type: "array", items: { $ref: "#/components/schemas/Account" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
          },
        },
        post: {
          operationId: "createAccount",
          tags: ["CRM · Cuentas"],
          summary: "Registrar una cuenta",
          description: [
            "Deja un lead en el CRM desde un formulario web, un anuncio o un chatbot. Requiere `write` y nivel Miembro en el CRM.",
            "",
            "**Un nombre repetido no falla:** devuelve la cuenta que ya existe, con `200` en vez de `201`. Los formularios se envían dos veces todo el tiempo, y un duplicado en el CRM cuesta más que una llamada idempotente.",
            "",
            "Sin `stage`, la cuenta nace como `LEAD`: nadie conecta un formulario para registrar clientes ya cerrados.",
          ].join("\n"),
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["name"],
                  properties: {
                    name: { type: "string", maxLength: 160, example: "Acme S.A.S." },
                    stage: { type: "string", enum: ACCOUNT_STAGE, default: "LEAD" },
                    taxId: { type: "string", nullable: true },
                    source: { type: "string", nullable: true, example: "Formulario web" },
                    ownerId: { type: "string", nullable: true, description: "Comercial que la lleva. Tiene que ser del equipo y estar activo." },
                  },
                },
              },
            },
          },
          responses: {
            "200": okWith("account", { $ref: "#/components/schemas/Account" }),
            "201": okWith("account", { $ref: "#/components/schemas/Account" }),
            ...commonErrors(notFound("El responsable indicado")),
          },
        },
      },

      "/accounts/{id}": {
        get: {
          operationId: "getAccount",
          tags: ["CRM · Cuentas"],
          summary: "Ver una cuenta",
          parameters: [idParam],
          responses: {
            "200": okWith("account", { $ref: "#/components/schemas/Account" }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
        patch: {
          operationId: "updateAccount",
          tags: ["CRM · Cuentas"],
          summary: "Actualizar una cuenta",
          description:
            "Solo los campos que se manden. Cambiar `stage` dispara además `account.stage_changed`, que es como se detecta desde fuera que un lead se volvió cliente. Requiere `write` y nivel Miembro en el CRM.",
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    name: { type: "string", maxLength: 160 },
                    stage: { type: "string", enum: ACCOUNT_STAGE },
                    taxId: { type: "string", nullable: true },
                    source: { type: "string", nullable: true },
                    ownerId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": okWith("account", { $ref: "#/components/schemas/Account" }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
      },

      "/accounts/{id}/contacts": {
        get: {
          operationId: "listContacts",
          tags: ["CRM · Cuentas"],
          summary: "Contactos de una cuenta",
          parameters: [idParam],
          responses: {
            "200": okWith("contacts", { type: "array", items: { $ref: "#/components/schemas/Contact" } }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
        post: {
          operationId: "createContact",
          tags: ["CRM · Cuentas"],
          summary: "Añadir un contacto",
          description:
            "La persona con la que se habla en esa empresa. Marcar `isPrimary` desmarca al anterior: solo hay un principal por cuenta. Requiere `write` y nivel Miembro en el CRM.",
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  description:
                    "Manda `firstName` (y opcionalmente `lastName`), o `name` entero. El correo es obligatorio.",
                  properties: {
                    firstName: { type: "string", maxLength: 80, example: "Ana" },
                    lastName: { type: "string", maxLength: 80, nullable: true, example: "Pérez Gómez" },
                    name: {
                      type: "string", maxLength: 160,
                      description:
                        "Nombre entero. Se acepta por compatibilidad con los workflows escritos antes de separar nombre y apellidos: se parte por el primer espacio.",
                    },
                    email: {
                      type: "string", format: "email",
                      description: "**Obligatorio desde la v1.76.0.** Un contacto sin correo no entra en ninguna campaña.",
                    },
                    phone: {
                      type: "string", nullable: true,
                      description:
                        "Se guarda en E.164. Se acepta con espacios, guiones o con `00` delante; si llega sin indicativo se le pone el de `phoneDial`.",
                      example: "300 123 4567",
                    },
                    phoneDial: {
                      type: "string", nullable: true, default: "+57",
                      description: "Indicativo para los números que llegan sin él.",
                      example: "+57",
                    },
                    position: { type: "string", nullable: true, example: "Directora de marketing" },
                    notes: { type: "string", nullable: true },
                    isPrimary: { type: "boolean", default: false },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("contact", { $ref: "#/components/schemas/Contact" }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
      },

      "/accounts/{id}/activities": {
        get: {
          operationId: "listActivities",
          tags: ["CRM · Cuentas"],
          summary: "Historial de una cuenta",
          description:
            "Todo lo apuntado sobre la cuenta, incluida la actividad de sus oportunidades, de lo más reciente a lo más viejo.",
          parameters: [idParam, ...paginationParams],
          responses: {
            "200": okWith("activities", { type: "array", items: { $ref: "#/components/schemas/Activity" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
          },
        },
        post: {
          operationId: "logActivity",
          tags: ["CRM · Cuentas"],
          summary: "Apuntar una interacción",
          description: [
            "Deja una llamada, un correo, una reunión o una nota en el historial. Es el endpoint que conecta la centralita o el buzón con el CRM sin que nadie teclee nada. Requiere `write` y nivel Miembro en el CRM.",
            "",
            "`occurredAt` es opcional: sin él se asume que acaba de pasar, que es el caso de un sistema que avisa en el momento. Mándalo si el evento llega tarde.",
            "",
            "`contactId` y `dealId`, si se mandan, tienen que ser de esta misma cuenta.",
          ].join("\n"),
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["summary"],
                  properties: {
                    summary: { type: "string", maxLength: 200, example: "Llamada de descubrimiento" },
                    type: { type: "string", enum: ACTIVITY_TYPE, default: "NOTA" },
                    notes: { type: "string", nullable: true },
                    occurredAt: { type: "string", format: "date-time", nullable: true },
                    contactId: { type: "string", nullable: true },
                    dealId: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("activity", { $ref: "#/components/schemas/Activity" }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
      },

      // ── CRM · Oportunidades ──
      "/deals": {
        get: {
          operationId: "listDeals",
          tags: ["CRM · Oportunidades"],
          summary: "Listar oportunidades",
          description: "Requiere `read` y nivel Lectura en el CRM.",
          parameters: [
            { name: "stage", in: "query", description: "Filtra por etapa del pipeline.", schema: { type: "string", enum: DEAL_STAGE } },
            { name: "accountId", in: "query", description: "Solo las de una cuenta.", schema: { type: "string" } },
            {
              name: "open",
              in: "query",
              description: "`true` deja solo las vivas; `false`, solo las cerradas. Sin el parámetro salen todas.",
              schema: { type: "boolean" },
            },
            ...paginationParams,
          ],
          responses: {
            "200": okWith("deals", { type: "array", items: { $ref: "#/components/schemas/Deal" } }, {
              nextCursor: { type: "string", nullable: true },
            }),
            ...commonErrors(),
          },
        },
        post: {
          operationId: "createDeal",
          tags: ["CRM · Oportunidades"],
          summary: "Abrir una oportunidad",
          description:
            "Una venta concreta sobre una cuenta. Una misma empresa puede tener varias abiertas. Requiere `write` y nivel Miembro en el CRM.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["title", "accountId"],
                  properties: {
                    title: { type: "string", maxLength: 160, example: "Rediseño del sitio web" },
                    accountId: { type: "string" },
                    stage: { type: "string", enum: DEAL_STAGE, default: "NUEVA" },
                    amount: { type: "number", nullable: true, example: 8000000 },
                    expectedCloseAt: { type: "string", format: "date-time", nullable: true },
                    contactId: { type: "string", nullable: true, description: "Tiene que ser un contacto de esa cuenta." },
                    ownerId: { type: "string", nullable: true },
                    notes: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "201": okWith("deal", { $ref: "#/components/schemas/Deal" }),
            ...commonErrors(notFound("La cuenta")),
          },
        },
      },

      "/deals/{id}": {
        get: {
          operationId: "getDeal",
          tags: ["CRM · Oportunidades"],
          summary: "Ver una oportunidad",
          parameters: [idParam],
          responses: {
            "200": okWith("deal", { $ref: "#/components/schemas/Deal" }),
            ...commonErrors(notFound("La oportunidad")),
          },
        },
        patch: {
          operationId: "updateDeal",
          tags: ["CRM · Oportunidades"],
          summary: "Actualizar o mover una oportunidad",
          description: [
            "Solo los campos que se manden. Requiere `write` y nivel Miembro en el CRM.",
            "",
            "Mandar `stage` la mueve en el pipeline igual que arrastrar la tarjeta: pasar a `GANADA` o `PERDIDA` sella la fecha de cierre, y sacarla de ahí la borra. Dispara `deal.stage_changed` y, al cerrar, además `deal.won` o `deal.lost`.",
            "",
            "`lostReason` solo se guarda cuando la etapa es `PERDIDA`.",
          ].join("\n"),
          parameters: [idParam],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    title: { type: "string", maxLength: 160 },
                    stage: { type: "string", enum: DEAL_STAGE },
                    amount: { type: "number", nullable: true },
                    expectedCloseAt: { type: "string", format: "date-time", nullable: true },
                    contactId: { type: "string", nullable: true },
                    ownerId: { type: "string", nullable: true },
                    notes: { type: "string", nullable: true },
                    lostReason: { type: "string", maxLength: 200, nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            "200": okWith("deal", { $ref: "#/components/schemas/Deal" }),
            ...commonErrors(notFound("La oportunidad")),
          },
        },
      },
    },
  };
}
