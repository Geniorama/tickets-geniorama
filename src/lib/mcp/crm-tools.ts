/**
 * Herramientas del CRM para el servidor MCP: cuentas, contactos,
 * oportunidades y actividades.
 *
 * Igual que el resto del MCP, son una puerta más a `src/lib/api/crm`, que ya
 * aplica la frontera del módulo con el mismo `can()` que las pantallas. Aquí
 * además se consulta antes de registrar nada: quien no tiene el CRM no ve
 * estas herramientas, y quien solo puede verlo no ve las de crear o editar. Una
 * herramienta que siempre responde «sin permiso» solo confunde al asistente.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { can } from "@/lib/access/can";
import type { ApiUser } from "@/lib/api/respond";
import type { WriteResult } from "@/lib/api/tickets";
import {
  isDenied,
  listAccounts, getAccount, createAccountViaApi, updateAccountViaApi,
  listContacts, createContactViaApi,
  listDeals, getDeal, createDealViaApi, updateDealViaApi,
  listActivities, logActivityViaApi,
} from "@/lib/api/crm";

const ACCOUNT_STAGE = z.enum(["LEAD", "PROSPECTO", "CLIENTE", "INACTIVO"]);
const DEAL_STAGE = z.enum(["NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA"]);
const ACTIVITY_TYPE = z.enum(["NOTA", "LLAMADA", "CORREO", "REUNION", "WHATSAPP"]);

const date = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "Fecha no válida")
  .describe("Fecha ISO, p. ej. 2026-10-20");

const page = {
  limit: z.number().int().min(1).max(100).optional().describe("Máximo de resultados (1–100, por defecto 25)"),
  cursor: z.string().optional().describe("nextCursor de la respuesta anterior, para la página siguiente"),
};

const ownerId = z.string().nullable().optional().describe('Id de un usuario del equipo, "me" o null');

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

/** Lecturas: devuelven datos, el rechazo del módulo o `null` si no existe. */
function fromRead(result: unknown, notFound: string) {
  if (result === null) return fail(notFound);
  if (isDenied(result)) return fail(result.error);
  return ok(result);
}

function fromWrite<T>(result: WriteResult<T>, key: string) {
  return result.ok ? ok({ [key]: result.value }) : fail(result.error);
}

function toDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  return v === null ? null : new Date(v);
}

export async function registerCrmTools(server: McpServer, user: ApiUser, canWrite: boolean): Promise<void> {
  const [canSee, canCreate, canEdit] = await Promise.all([
    can(user, "CRM", "ver"),
    can(user, "CRM", "crear"),
    can(user, "CRM", "editar"),
  ]);
  if (!canSee) return;

  const me = (id: string | null | undefined) => (id === "me" ? user.id : id);
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

  // ─── Lectura ───────────────────────────────────────────────────────────────

  server.registerTool(
    "crm_list_accounts",
    {
      title: "CRM: listar cuentas",
      description: "Cuentas (empresas) del CRM, por nombre. Filtra por etapa o busca por nombre.",
      inputSchema: {
        stage: ACCOUNT_STAGE.optional(),
        search: z.string().optional().describe("Parte del nombre"),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ stage, search, limit, cursor }) =>
      fromRead(await listAccounts(user, { limit: limit ?? 25, cursor: cursor ?? null, stage, search }), ""),
  );

  server.registerTool(
    "crm_get_account",
    {
      title: "CRM: ver cuenta",
      description: "Detalle de una cuenta por id.",
      inputSchema: { accountId: z.string() },
      annotations: readOnly,
    },
    async ({ accountId }) => fromRead(await getAccount(user, accountId), "Cuenta no encontrada"),
  );

  server.registerTool(
    "crm_list_contacts",
    {
      title: "CRM: contactos de una cuenta",
      description: "Contactos activos de una cuenta, el principal primero.",
      inputSchema: { accountId: z.string() },
      annotations: readOnly,
    },
    async ({ accountId }) => fromRead(await listContacts(user, accountId), "Cuenta no encontrada"),
  );

  server.registerTool(
    "crm_list_deals",
    {
      title: "CRM: listar oportunidades",
      description: "Oportunidades de venta. open=true devuelve solo el pipeline vivo (sin ganadas ni perdidas).",
      inputSchema: {
        stage: DEAL_STAGE.optional(),
        accountId: z.string().optional(),
        open: z.boolean().optional(),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ stage, accountId, open, limit, cursor }) =>
      fromRead(await listDeals(user, { limit: limit ?? 25, cursor: cursor ?? null, stage, accountId, open }), ""),
  );

  server.registerTool(
    "crm_get_deal",
    {
      title: "CRM: ver oportunidad",
      description: "Detalle de una oportunidad por id.",
      inputSchema: { dealId: z.string() },
      annotations: readOnly,
    },
    async ({ dealId }) => fromRead(await getDeal(user, dealId), "Oportunidad no encontrada"),
  );

  server.registerTool(
    "crm_list_activities",
    {
      title: "CRM: historial de actividades",
      description: "Llamadas, correos, reuniones y notas registradas, de la más reciente a la más antigua.",
      inputSchema: {
        accountId: z.string().optional(),
        dealId: z.string().optional(),
        ...page,
      },
      annotations: readOnly,
    },
    async ({ accountId, dealId, limit, cursor }) =>
      fromRead(await listActivities(user, { limit: limit ?? 25, cursor: cursor ?? null, accountId, dealId }), ""),
  );

  if (!canWrite) return;

  // ─── Crear ─────────────────────────────────────────────────────────────────

  if (canCreate) {
    server.registerTool(
      "crm_create_account",
      {
        title: "CRM: crear cuenta",
        description: "Crea una cuenta. Si ya existe una con el mismo nombre, devuelve esa en vez de duplicarla.",
        inputSchema: {
          name: z.string().trim().min(1).max(160),
          stage: ACCOUNT_STAGE.optional(),
          taxId: z.string().trim().max(60).nullable().optional().describe("NIT o identificación fiscal"),
          source: z.string().trim().max(80).nullable().optional().describe("De dónde llegó: web, referido…"),
          ownerId,
        },
        annotations: write,
      },
      async ({ ownerId: owner, ...rest }) =>
        fromWrite(await createAccountViaApi(user, { ...rest, ownerId: me(owner) }), "account"),
    );

    server.registerTool(
      "crm_create_contact",
      {
        title: "CRM: crear contacto",
        description: "Añade un contacto a una cuenta. El correo es obligatorio.",
        inputSchema: {
          accountId: z.string(),
          firstName: z.string().trim().min(1).max(80),
          lastName: z.string().trim().max(80).nullable().optional(),
          email: z.string().email().max(160),
          phone: z.string().trim().max(60).nullable().optional(),
          phoneDial: z.string().trim().max(6).nullable().optional().describe("Indicativo si el número no lo trae; por defecto +57"),
          position: z.string().trim().max(80).nullable().optional().describe("Cargo"),
          notes: z.string().max(2000).nullable().optional(),
          isPrimary: z.boolean().optional().describe("Marcarlo como contacto principal de la cuenta"),
        },
        annotations: write,
      },
      async ({ accountId, ...input }) => fromWrite(await createContactViaApi(user, accountId, input), "contact"),
    );

    server.registerTool(
      "crm_create_deal",
      {
        title: "CRM: crear oportunidad",
        description: "Crea una oportunidad de venta en una cuenta. Sin etapa nace NUEVA.",
        inputSchema: {
          title: z.string().trim().min(1).max(160),
          accountId: z.string(),
          stage: DEAL_STAGE.optional(),
          amount: z.number().nonnegative().nullable().optional().describe("Valor esperado"),
          expectedCloseAt: date.nullable().optional(),
          contactId: z.string().nullable().optional().describe("Contacto de la misma cuenta"),
          ownerId,
          notes: z.string().max(4000).nullable().optional(),
        },
        annotations: write,
      },
      async ({ expectedCloseAt, ownerId: owner, ...rest }) =>
        fromWrite(
          await createDealViaApi(user, { ...rest, ownerId: me(owner), expectedCloseAt: toDate(expectedCloseAt) ?? null }),
          "deal",
        ),
    );

    server.registerTool(
      "crm_log_activity",
      {
        title: "CRM: registrar actividad",
        description: "Apunta una interacción en el historial de una cuenta: llamada, correo, reunión, WhatsApp o nota.",
        inputSchema: {
          accountId: z.string(),
          summary: z.string().trim().min(1).max(200).describe("Qué pasó, en una línea"),
          type: ACTIVITY_TYPE.optional(),
          notes: z.string().max(4000).nullable().optional(),
          occurredAt: date.nullable().optional().describe("Cuándo ocurrió; por defecto, ahora"),
          contactId: z.string().nullable().optional(),
          dealId: z.string().nullable().optional(),
        },
        annotations: write,
      },
      async ({ accountId, occurredAt, ...rest }) =>
        fromWrite(await logActivityViaApi(user, accountId, { ...rest, occurredAt: toDate(occurredAt) ?? null }), "activity"),
    );
  }

  // ─── Editar ────────────────────────────────────────────────────────────────

  if (canEdit) {
    server.registerTool(
      "crm_update_account",
      {
        title: "CRM: actualizar cuenta",
        description: "Cambia solo los campos que se envíen. null borra NIT, origen o responsable.",
        inputSchema: {
          accountId: z.string(),
          name: z.string().trim().min(1).max(160).optional(),
          stage: ACCOUNT_STAGE.optional(),
          taxId: z.string().trim().max(60).nullable().optional(),
          source: z.string().trim().max(80).nullable().optional(),
          ownerId,
        },
        annotations: write,
      },
      async ({ accountId, ownerId: owner, ...rest }) =>
        fromWrite(
          await updateAccountViaApi(user, accountId, { ...rest, ...(owner !== undefined ? { ownerId: me(owner) } : {}) }),
          "account",
        ),
    );

    server.registerTool(
      "crm_update_deal",
      {
        title: "CRM: actualizar oportunidad",
        description:
          "Cambia solo los campos que se envíen: etapa, valor, fecha de cierre… Al pasarla a PERDIDA conviene indicar lostReason.",
        inputSchema: {
          dealId: z.string(),
          title: z.string().trim().min(1).max(160).optional(),
          stage: DEAL_STAGE.optional(),
          amount: z.number().nonnegative().nullable().optional(),
          expectedCloseAt: date.nullable().optional(),
          contactId: z.string().nullable().optional(),
          ownerId,
          notes: z.string().max(4000).nullable().optional(),
          lostReason: z.string().trim().max(200).nullable().optional(),
        },
        annotations: write,
      },
      async ({ dealId, expectedCloseAt, ownerId: owner, ...rest }) =>
        fromWrite(
          await updateDealViaApi(user, dealId, {
            ...rest,
            ...(owner !== undefined ? { ownerId: me(owner) } : {}),
            ...(expectedCloseAt !== undefined ? { expectedCloseAt: toDate(expectedCloseAt) } : {}),
          }),
          "deal",
        ),
    );
  }
}
