"use server";

/**
 * Planificar tickets con IA.
 *
 * El mismo movimiento que el planificador de proyectos, pero con la unidad de
 * trabajo de soporte: se pega un correo, un acta o un brief —o se sube el
 * PDF/Word— y la IA devuelve **una lista de tickets** para revisar antes de
 * abrirlos. Nada se crea hasta que alguien pulsa el botón.
 *
 * Dos reglas heredadas de `createTicket`, y por eso repetidas aquí:
 *
 *   · **Los ids no se creen.** Responsable, sitio y cliente que devuelve el
 *     modelo se validan contra lo que hay en base de datos; lo que no encaja
 *     se cae a null en vez de romper la creación.
 *   · **El cliente manda sobre el prefijo.** El código del ticket sale de la
 *     empresa (plan → empresa del cliente → TKT), igual que en el alta normal.
 */

import { Type } from "@google/genai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import {
  runStructuredJson,
  providerConfigError,
  isValidProvider,
  type AiProvider,
} from "@/lib/ai";
import { extractDocument, type AiDocumentFile } from "@/lib/ai-documents";
import { TICKET_CATEGORIES } from "@/lib/ticket-categories";
import { ticketPrefix } from "@/lib/ticket-code";
import { DEFAULT_CHECKLIST_TITLE } from "@/lib/checklist";
import { createChecklistGroups } from "@/lib/checklists";
import { notify, notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { emitTicketHook } from "@/lib/hooks/dispatch";
import type { Priority } from "@/generated/prisma";

const PRIORITY_VALUES: Priority[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

/** Tope de tickets por documento: más que esto no se revisa, se acepta a ciegas. */
const MAX_TICKETS = 25;

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type { AiProvider } from "@/lib/ai";

export type TicketPlannerFile = AiDocumentFile;

export type PlannedTicket = {
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  categoria: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  siteId: string | null;
  siteName: string | null;
  fechaLimite: string | null;
  subtareas: string[];
};

export type GeneratedTicketPlan = {
  resumen: string;
  /** Cliente que la IA reconoció en el documento, si quien planifica no lo fijó. */
  clienteId: string | null;
  clienteNombre: string | null;
  tickets: PlannedTicket[];
};

export type TicketPlannerOptions = {
  /** Solo el admin elige cliente, plan y responsable, como en «Nuevo ticket». */
  canAssign: boolean;
  clients: { id: string; name: string; companyIds: string[] }[];
  plans: { id: string; name: string; companyId: string }[];
  sites: { id: string; name: string; domain: string; companyId: string }[];
  staff: { id: string; name: string; cargo: string | null; area: string | null }[];
  categories: string[];
};

export type ApplyTicketPlanInput = {
  clientId: string | null;
  planId: string | null;
  tickets: {
    titulo: string;
    descripcion: string;
    prioridad: Priority;
    categoria: string | null;
    assignedToId: string | null;
    siteId: string | null;
    fechaLimite: string | null;
    subtareas: string[];
  }[];
};

// ─── Opciones para la UI ───────────────────────────────────────────────────────

export async function getTicketPlannerOptions(): Promise<TicketPlannerOptions | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);

  const [clients, plans, sites, staff] = await Promise.all([
    admin
      ? prisma.user.findMany({
          where: { role: "CLIENTE", isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, companies: { select: { id: true } } },
        })
      : Promise.resolve([]),
    admin
      ? prisma.plan.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, companyId: true },
        })
      : Promise.resolve([]),
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, companyId: true },
    }),
    admin
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, cargo: true, area: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    canAssign: admin,
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name ?? "—",
      companyIds: c.companies.map((co) => co.id),
    })),
    plans,
    sites,
    staff: staff.map((s) => ({ id: s.id, name: s.name ?? "—", cargo: s.cargo, area: s.area })),
    categories: TICKET_CATEGORIES,
  };
}

// ─── Esquema de salida estructurada ────────────────────────────────────────────

const ticketPlanResponseSchema = {
  type: Type.OBJECT,
  properties: {
    resumen: { type: Type.STRING, description: "Resumen breve de lo que se detectó en el documento." },
    clienteId: {
      type: Type.STRING,
      nullable: true,
      description: "ID del cliente de la lista provista si el documento lo identifica, o null.",
    },
    tickets: {
      type: Type.ARRAY,
      description: "Incidencias o solicitudes detectadas en el documento.",
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: "Título corto y concreto de la incidencia." },
          descripcion: { type: Type.STRING, description: "Qué pasa, dónde y qué se espera. 2-5 frases." },
          prioridad: { type: Type.STRING, enum: PRIORITY_VALUES },
          categoria: { type: Type.STRING, nullable: true, enum: TICKET_CATEGORIES },
          responsableId: { type: Type.STRING, nullable: true, description: "ID del responsable sugerido, o null." },
          sitioId: { type: Type.STRING, nullable: true, description: "ID del sitio/app afectado de la lista, o null." },
          fechaLimite: { type: Type.STRING, nullable: true, description: "Fecha límite ISO YYYY-MM-DD o null." },
          subtareas: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Pasos concretos de resolución (checklist)." },
        },
        required: ["titulo", "descripcion", "prioridad"],
      },
    },
  },
  required: ["resumen", "tickets"],
};

// ─── generateTicketPlan ────────────────────────────────────────────────────────

export async function generateTicketPlan(input: {
  text?: string;
  file?: TicketPlannerFile;
  clientId?: string;
  provider?: AiProvider;
}): Promise<GeneratedTicketPlan | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);

  const provider: AiProvider = isValidProvider(input.provider) ? input.provider : "gemini";
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  // Documento: texto pegado + archivo
  let docText = (input.text ?? "").trim();
  let pdfBase64: string | undefined;
  if (input.file) {
    const extracted = await extractDocument(input.file);
    if (extracted.error) return { error: extracted.error };
    if (extracted.pdfBase64) pdfBase64 = extracted.pdfBase64;
    if (extracted.text) docText = `${docText}\n\n${extracted.text}`.trim();
  }
  if (!docText && !pdfBase64) {
    return { error: "Proporciona el texto del documento o sube un archivo." };
  }

  // Contexto real contra el que se validan después las sugerencias del modelo.
  const [clients, staff, sites] = await Promise.all([
    // Los clientes solo se ofrecen si nadie fijó uno y quien planifica puede elegirlo.
    admin && !input.clientId
      ? prisma.user.findMany({
          where: { role: "CLIENTE", isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, companies: { select: { name: true }, take: 1 } },
        })
      : Promise.resolve([] as { id: string; name: string | null; companies: { name: string }[] }[]),
    admin
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, cargo: true, area: true },
        })
      : Promise.resolve([] as { id: string; name: string | null; cargo: string | null; area: string | null }[]),
    // Con cliente fijado, solo sus sitios: proponer el de otra empresa es ruido.
    input.clientId
      ? prisma.site.findMany({
          where: { isActive: true, company: { users: { some: { id: input.clientId } } } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true },
        })
      : prisma.site.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true },
          take: 150,
        }),
  ]);

  const staffMap = new Map(staff.map((s) => [s.id, s.name ?? "—"]));
  const clientMap = new Map(clients.map((c) => [c.id, c.name ?? "—"]));
  const siteMap = new Map(sites.map((s) => [s.id, s.name]));

  const teamLines = staff
    .map((s) => `- ID:${s.id} · ${s.name ?? "—"}${s.cargo ? ` (${s.cargo}${s.area ? `, ${s.area}` : ""})` : ""}`)
    .join("\n");
  const clientLines = clients
    .map((c) => `- ID:${c.id} · ${c.name ?? "—"}${c.companies[0] ? ` (${c.companies[0].name})` : ""}`)
    .join("\n");
  const siteLines = sites.map((s) => `- ID:${s.id} · ${s.name} (${s.domain})`).join("\n");

  const hoy = new Date().toISOString().slice(0, 10);

  const prompt = `Eres un agente de soporte de Geniorama, una agencia de desarrollo y mantenimiento web. A partir del documento (correo de un cliente, acta de reunión, brief, listado de fallos…) extrae **los tickets de soporte que hay que abrir**.

Hoy es ${hoy}.

Instrucciones:
- Un ticket por **problema o solicitud independiente**. No mezcles dos fallos distintos en un ticket ni partas uno solo en varios.
- Título: corto y concreto, pensado para leerse en un listado ("El formulario de contacto no envía correos").
- Descripción: qué ocurre, dónde y qué se espera, con los datos que dé el documento (URLs, mensajes de error, pasos para reproducir). Entre 2 y 5 frases. No inventes detalles técnicos que el documento no diga.
- Prioridad: BAJA, MEDIA, ALTA o CRITICA, según el impacto que describa el documento (algo caído o que impide vender es CRITICA; un ajuste estético es BAJA).
- Categoría: elige una de esta lista exacta, o null si ninguna encaja — ${TICKET_CATEGORIES.join(", ")}.
- Subtareas: los pasos concretos de resolución, si el documento da pistas suficientes. Si no, deja la lista vacía.
- fechaLimite en formato YYYY-MM-DD solo si el documento menciona un plazo; si no, null.
- No inventes IDs: usa únicamente los de las listas de abajo, o null.
- Responde SIEMPRE en español.

${
  admin && !input.clientId
    ? `Clientes disponibles (rellena "clienteId" con el ID exacto si el documento identifica de quién es, o null):\n${clientLines || "(ninguno)"}`
    : `El cliente ya lo fijó quien planifica: deja "clienteId" en null.`
}

${
  admin
    ? `Equipo disponible para sugerir responsable (campo "responsableId", ID exacto o null si no hay un encargado claro):\n${teamLines || "(sin equipo)"}`
    : `No sugieras responsables: deja "responsableId" en null.`
}

Sitios y apps registrados (campo "sitioId", ID exacto o null si el documento no señala uno):
${siteLines || "(ninguno)"}

${docText ? `--- DOCUMENTO ---\n${docText}` : "(El documento se adjunta como archivo PDF.)"}

--- FORMATO DE SALIDA (JSON) ---
Responde ÚNICAMENTE con un objeto JSON con esta forma exacta (sin texto adicional):
{"resumen": string, "clienteId": string|null, "tickets": [{"titulo": string, "descripcion": string, "prioridad": "BAJA"|"MEDIA"|"ALTA"|"CRITICA", "categoria": string|null, "responsableId": string|null, "sitioId": string|null, "fechaLimite": "YYYY-MM-DD"|null, "subtareas": string[]}]}`;

  let raw: string;
  try {
    raw = await runStructuredJson({
      provider,
      prompt,
      pdfBase64,
      geminiResponseSchema: ticketPlanResponseSchema,
    });
  } catch (err) {
    console.error(`AI error (ticket-planner/${provider}):`, err);
    return { error: "Error al contactar el servicio de IA. Verifica la configuración." };
  }

  let parsed: {
    resumen?: string;
    clienteId?: string | null;
    tickets?: {
      titulo?: string;
      descripcion?: string;
      prioridad?: string;
      categoria?: string | null;
      responsableId?: string | null;
      sitioId?: string | null;
      fechaLimite?: string | null;
      subtareas?: string[];
    }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "La IA devolvió un formato inesperado. Intenta de nuevo." };
  }

  const tickets: PlannedTicket[] = (parsed.tickets ?? [])
    .filter((t) => t.titulo && t.titulo.trim())
    .slice(0, MAX_TICKETS)
    .map((t) => {
      const respId = t.responsableId && staffMap.has(t.responsableId) ? t.responsableId : null;
      const sitioId = t.sitioId && siteMap.has(t.sitioId) ? t.sitioId : null;
      const prioridad = PRIORITY_VALUES.includes(t.prioridad as Priority) ? (t.prioridad as Priority) : "MEDIA";
      const categoria = t.categoria && TICKET_CATEGORIES.includes(t.categoria) ? t.categoria : null;
      return {
        titulo: t.titulo!.trim().slice(0, 200),
        descripcion: (t.descripcion ?? "").trim() || t.titulo!.trim(),
        prioridad,
        categoria,
        assignedToId: respId,
        assignedToName: respId ? staffMap.get(respId) ?? null : null,
        siteId: sitioId,
        siteName: sitioId ? siteMap.get(sitioId) ?? null : null,
        fechaLimite: normalizeDate(t.fechaLimite),
        subtareas: Array.isArray(t.subtareas)
          ? t.subtareas.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
          : [],
      };
    });

  if (tickets.length === 0) {
    return { error: "No se pudieron extraer tickets del documento. Intenta con más detalle." };
  }

  const clienteId = parsed.clienteId && clientMap.has(parsed.clienteId) ? parsed.clienteId : null;

  return {
    resumen: (parsed.resumen ?? "").trim() || "Tickets extraídos del documento.",
    clienteId,
    clienteNombre: clienteId ? clientMap.get(clienteId) ?? null : null,
    tickets,
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return m ? m[0] : null;
}

// ─── applyTicketPlan ───────────────────────────────────────────────────────────

export async function applyTicketPlan(
  input: ApplyTicketPlanInput
): Promise<{ success: true; createdCount: number; message: string } | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);
  const userId = session.user.id;

  const wanted = (input.tickets ?? []).filter((t) => t.titulo && t.titulo.trim()).slice(0, MAX_TICKETS);
  if (wanted.length === 0) return { error: "No hay tickets para crear." };

  // Cliente, plan y responsables solo los fija el admin, igual que en el alta
  // normal: para un colaborador esos campos ni existen en el formulario.
  const clientId = admin ? input.clientId ?? null : null;
  const planId = admin ? input.planId ?? null : null;

  if (clientId) {
    const client = await prisma.user.findFirst({
      where: { id: clientId, isActive: true, role: "CLIENTE" },
      select: { id: true },
    });
    if (!client) return { error: "El cliente seleccionado no existe." };
  }
  if (planId) {
    const plan = await prisma.plan.findFirst({
      where: { id: planId, isActive: true },
      select: { id: true },
    });
    if (!plan) return { error: "El plan seleccionado no existe." };
  }

  // Responsables válidos (staff activo), con su nombre para las notificaciones.
  const requestedAssignees = [...new Set(wanted.map((t) => t.assignedToId).filter((id): id is string => !!id))];
  const assigneeNames = new Map<string, string>(
    admin && requestedAssignees.length > 0
      ? (
          await prisma.user.findMany({
            where: {
              id: { in: requestedAssignees },
              isActive: true,
              role: { in: ["ADMINISTRADOR", "COLABORADOR"] },
            },
            select: { id: true, name: true },
          })
        ).map((u) => [u.id, u.name ?? "—"] as const)
      : []
  );

  // Sitios válidos: los del cliente si hay uno, cualquiera activo si no.
  const requestedSites = [...new Set(wanted.map((t) => t.siteId).filter((id): id is string => !!id))];
  const validSites = new Set(
    requestedSites.length > 0
      ? (
          await prisma.site.findMany({
            where: {
              id: { in: requestedSites },
              isActive: true,
              ...(clientId ? { company: { users: { some: { id: clientId } } } } : {}),
            },
            select: { id: true },
          })
        ).map((s) => s.id)
      : []
  );

  // Prefijo: plan → empresa del cliente → TKT, como en `createTicket`.
  let companyName: string | null = null;
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { company: { select: { name: true } } },
    });
    companyName = plan?.company?.name ?? null;
  }
  if (!companyName && clientId) {
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { companies: { select: { name: true }, take: 1 } },
    });
    companyName = client?.companies[0]?.name ?? null;
  }
  const prefix = ticketPrefix(companyName);

  type CreatedTicket = { id: string; title: string; assignedToId: string | null; dueDate: Date | null };
  const created: CreatedTicket[] = [];

  await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextNumber = (last?.number ?? 0) + 1;

    for (const t of wanted) {
      const assignedToId = t.assignedToId && assigneeNames.has(t.assignedToId) ? t.assignedToId : null;
      const prioridad = PRIORITY_VALUES.includes(t.prioridad) ? t.prioridad : "MEDIA";
      const categoria = t.categoria && t.categoria.trim() ? t.categoria.trim().slice(0, 100) : null;
      const siteId = t.siteId && validSites.has(t.siteId) ? t.siteId : null;
      const dueDate = t.fechaLimite ? new Date(t.fechaLimite) : null;

      const row = await tx.ticket.create({
        data: {
          title: t.titulo.trim(),
          description: t.descripcion?.trim() || t.titulo.trim(),
          priority: prioridad,
          category: categoria,
          assignedToId,
          clientId,
          planId,
          siteId,
          createdById: userId,
          dueDate,
          prefix,
          number: nextNumber++,
          reviewers: { connect: [{ id: userId }] },
        },
        select: { id: true },
      });

      const subs = (t.subtareas ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 20);
      if (subs.length > 0) {
        await createChecklistGroups(
          { entityType: "TICKET", entityId: row.id },
          [{ title: DEFAULT_CHECKLIST_TITLE, items: subs }],
          userId,
          tx,
        );
      }

      created.push({ id: row.id, title: t.titulo.trim(), assignedToId, dueDate });
    }
  });

  // Webhook de equipo: un aviso por ticket, con responsable y fecha, igual que
  // el alta normal. El asignado recibe además el suyo in-app, sin repetirlo en
  // Chat (`skipGChat`), que es exactamente lo que hace `createTicket`.
  for (const t of created) {
    const parts: string[] = [`"${t.title}"`];
    if (t.assignedToId) parts.push(`Asignado a: ${assigneeNames.get(t.assignedToId) ?? "—"}`);
    if (t.dueDate) {
      const fmt = t.dueDate.toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
      });
      parts.push(`Límite: ${fmt}`);
    }
    await sendGChatNotification(
      "ticket_new",
      "Nuevo ticket",
      `${session.user.name} creó: ${parts.join(" · ")}`,
      `/tickets/${t.id}`
    );

    if (t.assignedToId && t.assignedToId !== userId) {
      await notify(
        t.assignedToId,
        "ticket_assigned",
        "Ticket asignado",
        `Se te asignó: "${t.title}"`,
        `/tickets/${t.id}`,
        true
      );
    }

    emitTicketHook("ticket.created", t.id, { actor: session.user });
  }

  // Al cliente se le avisa una vez de toda la tanda: son sus tickets, pero
  // quince notificaciones seguidas no informan de nada.
  if (clientId && clientId !== userId) {
    await notifyMany(
      [clientId],
      "ticket_new",
      created.length === 1 ? "Nuevo ticket" : "Nuevos tickets",
      created.length === 1
        ? `Se abrió un ticket a tu nombre: "${created[0].title}"`
        : `Se abrieron ${created.length} tickets a tu nombre`,
      created.length === 1 ? `/tickets/${created[0].id}` : "/tickets",
      true
    );
  }

  revalidatePath("/tickets");
  return {
    success: true,
    createdCount: created.length,
    message: `${created.length} ${created.length === 1 ? "ticket creado" : "tickets creados"}.`,
  };
}
