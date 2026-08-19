/**
 * El agente conversacional de WhatsApp.
 *
 * Reparto de responsabilidades, que es lo que hace este archivo entendible:
 *
 *   · El **modelo** entiende lo que pide el usuario, redacta y decide qué
 *     herramienta llamar. Nada más.
 *   · El **código** valida cada llamada contra el contexto (lista blanca de
 *     tickets), ejecuta contra la base y redacta los mensajes de confirmación.
 *
 * Por eso los textos de "ticket creado" y "esto voy a crear" no los escribe el
 * modelo: son plantillas de aquí. Un resumen alucinado de lo que se acaba de
 * crear sería peor que no responder nada.
 *
 * Crear un ticket **siempre** pasa por confirmación explícita. Comentar no: es
 * aditivo y se puede corregir con otro comentario.
 */

import { Type, type FunctionDeclaration } from "@google/genai";
import type OpenAI from "openai";
import {
  runAssistantChat,
  isValidProvider,
  providerConfigError,
  type AiProvider,
  type ChatMsg,
  type ToolCall,
} from "@/lib/ai";
import { buildWhatsappContext, type TicketCtx } from "@/lib/whatsapp/context";
import { AGENT_PROMPT_KEY, DEFAULT_AGENT_PROMPT } from "@/lib/whatsapp/prompt";
import { prisma } from "@/lib/prisma";
import { addCommentFromWhatsapp, announceWhatsappTicket, createTicketFromWhatsapp } from "@/lib/whatsapp/write";
import type { PendingAction, Conversation } from "@/lib/whatsapp/conversation";
import type { Priority } from "@/generated/prisma";

/** WhatsApp corta los mensajes en 4096 caracteres. */
const MAX_REPLY_CHARS = 3800;

const PRIORITY_VALUES: Priority[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];
const PRIORITY_LABELS: Record<Priority, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};

/** Proveedor de IA del canal. Se puede cambiar sin tocar código. */
function channelProvider(): AiProvider {
  const raw = process.env.WHATSAPP_AI_PROVIDER;
  return isValidProvider(raw) ? raw : "gemini";
}

// ─── Herramientas ────────────────────────────────────────────────────────────

const CREAR_TICKET_DESC =
  "Propone crear un ticket de soporte. Úsala SOLO cuando ya tengas claro qué necesita el usuario: " +
  "un título corto y una descripción con el detalle suficiente para que el equipo trabaje sin volver a preguntar. " +
  "Si falta información, pregunta por texto en vez de llamar a esta función.";

const COMENTAR_DESC =
  "Agrega un comentario del usuario a uno de sus tickets existentes. El comentario queda visible para el equipo y le llega notificación al responsable.";

const CONFIRMAR_DESC =
  "Resuelve la propuesta de ticket que está esperando confirmación. Llámala en cuanto el usuario acepte o rechace.";

function geminiTools(hasPending: boolean): { functionDeclarations: FunctionDeclaration[] }[] {
  const decls: FunctionDeclaration[] = [
    {
      name: "crear_ticket",
      description: CREAR_TICKET_DESC,
      parameters: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: "Título corto y concreto, máximo 80 caracteres." },
          descripcion: { type: Type.STRING, description: "Qué pasa, dónde y desde cuándo, en las palabras del usuario." },
          prioridad: { type: Type.STRING, enum: PRIORITY_VALUES, description: "CRITICA solo si algo está caído o bloquea la operación." },
        },
        required: ["titulo", "descripcion"],
      },
    },
    {
      name: "comentar_ticket",
      description: COMENTAR_DESC,
      parameters: {
        type: Type.OBJECT,
        properties: {
          ticketId: { type: Type.STRING, description: "El ID exacto del ticket (campo ID: del contexto). Nunca el código." },
          texto: { type: Type.STRING, description: "El comentario, redactado en primera persona del usuario." },
        },
        required: ["ticketId", "texto"],
      },
    },
  ];

  if (hasPending) {
    decls.push({
      name: "confirmar_accion",
      description: CONFIRMAR_DESC,
      parameters: {
        type: Type.OBJECT,
        properties: {
          confirmado: { type: Type.BOOLEAN, description: "true si el usuario acepta crear el ticket, false si lo rechaza o quiere cambiarlo." },
        },
        required: ["confirmado"],
      },
    });
  }

  return [{ functionDeclarations: decls }];
}

function openaiTools(hasPending: boolean): OpenAI.Chat.Completions.ChatCompletionTool[] {
  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: "function",
      function: {
        name: "crear_ticket",
        description: CREAR_TICKET_DESC,
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título corto y concreto, máximo 80 caracteres." },
            descripcion: { type: "string", description: "Qué pasa, dónde y desde cuándo, en las palabras del usuario." },
            prioridad: { type: "string", enum: PRIORITY_VALUES, description: "CRITICA solo si algo está caído o bloquea la operación." },
          },
          required: ["titulo", "descripcion"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function",
      function: {
        name: "comentar_ticket",
        description: COMENTAR_DESC,
        parameters: {
          type: "object",
          properties: {
            ticketId: { type: "string", description: "El ID exacto del ticket (campo ID: del contexto). Nunca el código." },
            texto: { type: "string", description: "El comentario, redactado en primera persona del usuario." },
          },
          required: ["ticketId", "texto"],
          additionalProperties: false,
        },
      },
    },
  ];

  if (hasPending) {
    tools.push({
      type: "function",
      function: {
        name: "confirmar_accion",
        description: CONFIRMAR_DESC,
        parameters: {
          type: "object",
          properties: {
            confirmado: { type: "boolean", description: "true si el usuario acepta crear el ticket, false si lo rechaza o quiere cambiarlo." },
          },
          required: ["confirmado"],
          additionalProperties: false,
        },
      },
    });
  }

  return tools;
}

// ─── Instrucción de sistema ──────────────────────────────────────────────────

/**
 * El prompt vigente: el editado desde el panel si existe, o el de fábrica.
 *
 * Se resuelve en cada mensaje a propósito. Guardar en el panel tiene efecto en
 * la siguiente respuesta, sin reiniciar nada, y una fila vacía o una caída de
 * la consulta caen de vuelta al texto por defecto en vez de dejar al agente
 * sin instrucciones.
 */
async function loadAgentPrompt(): Promise<string> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: AGENT_PROMPT_KEY } });
    const custom = row?.value.trim();
    return custom ? custom : DEFAULT_AGENT_PROMPT;
  } catch (err) {
    console.error("[whatsapp] No se pudo leer el prompt guardado, se usa el de fábrica:", err);
    return DEFAULT_AGENT_PROMPT;
  }
}

/**
 * Las dos notas condicionales no son editables desde el panel: interpolan
 * datos del turno y sostienen dos garantías del código —no abrir tickets sin
 * plan, no crear nada sin un «sí» explícito— que no pueden depender de lo que
 * alguien escriba en un textarea.
 */
function systemInstruction(base: string, pending: PendingAction | null, hasActivePlan: boolean): string {
  const planNote = hasActivePlan
    ? ""
    : `\n\nATENCIÓN: este cliente NO tiene plan activo. Puedes responderle sus dudas y consultar tickets, pero si pide abrir uno nuevo, explícale que primero necesita renovar el plan con su agente. No llames a crear_ticket.`;

  const pendingNote = pending
    ? `\n\nHAY UNA PROPUESTA PENDIENTE: le resumiste este ticket y estás esperando su respuesta.
  Título: ${pending.titulo}
  Prioridad: ${PRIORITY_LABELS[pending.prioridad]}
Lo primero que tienes que hacer con su mensaje es decidir si acepta o no, y llamar a confirmar_accion. Si en vez de aceptar pide un cambio, llama a confirmar_accion con false y vuelve a proponer con crear_ticket ya corregido.`
    : "";

  return base + planNote + pendingNote;
}

// ─── Orquestación ────────────────────────────────────────────────────────────

export type AgentOutcome = {
  reply: string;
  pending: PendingAction | null;
};

export async function runWhatsappAgent(
  userId: string,
  conv: Conversation,
  userText: string,
): Promise<AgentOutcome> {
  const provider = channelProvider();
  const cfgErr = providerConfigError(provider);
  if (cfgErr) {
    console.error("[whatsapp]", cfgErr);
    return {
      reply: "Ahora mismo no puedo procesar mensajes. Ya avisé al equipo; escríbele a tu agente mientras tanto.",
      pending: conv.pending,
    };
  }

  const [ctx, basePrompt] = await Promise.all([buildWhatsappContext(userId), loadAgentPrompt()]);
  const hasPending = conv.pending !== null;

  const messages: ChatMsg[] = [
    { role: "user", text: `Contexto actual del cliente:\n\n${ctx.contextText}` },
    { role: "assistant", text: "Entendido, tengo su plan y sus tickets a la vista." },
    ...conv.messages,
    { role: "user", text: userText },
  ];

  let result;
  try {
    result = await runAssistantChat({
      provider,
      system: systemInstruction(basePrompt, conv.pending, ctx.hasActivePlan),
      messages,
      geminiTools: geminiTools(hasPending),
      openaiTools: openaiTools(hasPending),
    });
  } catch (err) {
    console.error(`[whatsapp] Error del proveedor ${provider}:`, err);
    return {
      reply: "Se me cruzaron los cables un momento 😅 ¿Me lo repites?",
      pending: conv.pending,
    };
  }

  return applyToolCalls({
    userId,
    userName: ctx.userName,
    modelText: (result.text ?? "").trim(),
    toolCalls: result.toolCalls,
    pending: conv.pending,
    ticketMap: ctx.ticketMap,
    hasActivePlan: ctx.hasActivePlan,
  });
}

/**
 * Ejecuta lo que el modelo propuso y arma la respuesta final.
 *
 * Solo se atiende la primera llamada de escritura del turno: si el modelo
 * propone dos tickets de una, el segundo se pierde a propósito — un mensaje de
 * WhatsApp no puede confirmar dos cosas a la vez y la ambigüedad terminaría
 * creando algo que el usuario no aprobó.
 */
async function applyToolCalls(opts: {
  userId: string;
  userName: string;
  modelText: string;
  toolCalls: ToolCall[];
  pending: PendingAction | null;
  ticketMap: Map<string, TicketCtx>;
  hasActivePlan: boolean;
}): Promise<AgentOutcome> {
  const { toolCalls, pending, ticketMap } = opts;

  // ── 1. Resolver la propuesta pendiente ──
  const confirm = toolCalls.find((c) => c.name === "confirmar_accion");
  if (confirm && pending) {
    // Gemini a veces devuelve el booleano como la cadena "true".
    const accepted = confirm.args.confirmado === true || confirm.args.confirmado === "true";
    if (accepted) {
      const res = await createTicketFromWhatsapp(opts.userId, {
        titulo: pending.titulo,
        descripcion: pending.descripcion,
        prioridad: pending.prioridad,
      });

      if (!res.ok) return { reply: res.error, pending: null };

      // El aviso al canal del equipo no debe tumbar la respuesta al cliente.
      void announceWhatsappTicket(res.code, pending.titulo, opts.userName, res.ticketId).catch(() => {});

      return {
        reply: trim(
          `Listo, tu ticket quedó abierto ✅\n\n` +
            `*${res.code}* — ${pending.titulo}\n` +
            `Prioridad: ${PRIORITY_LABELS[pending.prioridad]}\n\n` +
            `El equipo ya recibió la notificación. Puedes preguntarme por él cuando quieras, o seguirlo aquí:\n${res.url}`,
        ),
        pending: null,
      };
    }

    // Rechazó. Si además propuso un ticket corregido en el mismo turno, ese
    // reemplaza al anterior; si no, se cancela sin más.
    const replacement = buildPending(toolCalls);
    if (replacement) return proposalReply(opts.modelText, replacement);

    return {
      reply: opts.modelText || "Sin problema, no lo creo. Dime qué ajusto y lo volvemos a armar.",
      pending: null,
    };
  }

  // ── 2. Comentar un ticket ──
  const comment = toolCalls.find((c) => c.name === "comentar_ticket");
  if (comment) {
    const ticketId = String(comment.args.ticketId ?? "");
    const texto = String(comment.args.texto ?? "").trim();
    const ticket = ticketMap.get(ticketId);

    if (!ticket) {
      return {
        reply: "No encontré ese ticket entre los tuyos. ¿Me pasas su código? (por ejemplo ACM-12)",
        pending,
      };
    }
    if (!texto) {
      return { reply: "¿Qué quieres que deje escrito en el ticket?", pending };
    }

    const res = await addCommentFromWhatsapp(opts.userId, ticketId, texto);
    if (!res.ok) return { reply: res.error, pending };

    return {
      reply: trim(
        `Anotado en *${res.code}* 📝\n\n"${texto}"\n\nEl responsable ya recibió la notificación.`,
      ),
      pending,
    };
  }

  // ── 3. Proponer un ticket nuevo ──
  const proposal = buildPending(toolCalls);
  if (proposal) {
    if (!opts.hasActivePlan) {
      return {
        reply:
          "Me encantaría abrirlo, pero tu plan no está activo en este momento. " +
          "Escríbele a tu agente para renovarlo y lo creamos enseguida.",
        pending: null,
      };
    }
    return proposalReply(opts.modelText, proposal);
  }

  // ── 4. Solo texto ──
  return {
    reply: trim(opts.modelText || "No estoy seguro de haberte entendido. ¿Me lo cuentas de otra forma?"),
    pending,
  };
}

/** Traduce una llamada `crear_ticket` a una propuesta validada, o null. */
function buildPending(toolCalls: ToolCall[]): PendingAction | null {
  const call = toolCalls.find((c) => c.name === "crear_ticket");
  if (!call) return null;

  const titulo = String(call.args.titulo ?? "").trim().slice(0, 200);
  if (!titulo) return null;

  const descripcion = String(call.args.descripcion ?? "").trim() || titulo;
  const raw = String(call.args.prioridad ?? "MEDIA").toUpperCase() as Priority;
  const prioridad = PRIORITY_VALUES.includes(raw) ? raw : "MEDIA";

  return { kind: "ticket", titulo, descripcion, prioridad, at: new Date().toISOString() };
}

/** Resumen de la propuesta. Lo redacta el sistema para que coincida palabra por
 *  palabra con lo que se creará si el usuario dice que sí. */
function proposalReply(modelText: string, pending: PendingAction): AgentOutcome {
  const intro = modelText ? `${modelText}\n\n` : "Perfecto, esto es lo que voy a abrir:\n\n";
  return {
    reply: trim(
      `${intro}*${pending.titulo}*\n` +
        `${pending.descripcion}\n` +
        `Prioridad: ${PRIORITY_LABELS[pending.prioridad]}\n\n` +
        `¿Lo creo así? Respóndeme *sí* para confirmar, o dime qué cambio.`,
    ),
    pending,
  };
}

function trim(text: string): string {
  return text.length > MAX_REPLY_CHARS ? `${text.slice(0, MAX_REPLY_CHARS)}…` : text;
}
