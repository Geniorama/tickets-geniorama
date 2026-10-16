/**
 * La conversación con el agente, igual venga de donde venga: la página
 * `/mi-asistente`, el widget flotante de la plataforma o el widget insertado
 * en otro sitio. Quien llama ya resolvió quién es el usuario (sesión o token
 * del widget); aquí se comprueba que siga pudiendo usar el asistente.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findClient } from "@/lib/api/agent";
import { askAgent, getAgentChatConfig } from "@/lib/agent-chat";
import { AGENT_CHAT_EMBED_ORIGINS_KEY } from "@/lib/agent-chat-keys";
import { audioTranscriptionAvailable, transcribeAudio } from "@/lib/agent-chat-audio";

export type AgentChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** "audio": una nota de voz; `content` es lo que se transcribió. */
  kind: "text" | "audio";
  createdAt: string;
};

export type AgentChatState =
  | { available: true; name: string; conversationId: string | null; messages: AgentChatMessageView[]; audio: boolean }
  | { available: false; name: string | null; reason: string };

const MAX_MESSAGE = 2_000;
/** Cada mensaje cuesta una llamada al modelo: un tope generoso para una persona. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;
/** Cuántos mensajes de la última conversación se recuperan al entrar. */
const RESUME_LIMIT = 100;

const view = (m: { id: string; role: string; content: string; kind: string; createdAt: Date }): AgentChatMessageView => ({
  id: m.id,
  role: m.role === "assistant" ? "assistant" : "user",
  content: m.content,
  kind: m.kind === "audio" ? "audio" : "text",
  createdAt: m.createdAt.toISOString(),
});

/** ¿Puede este usuario usar el asistente ahora? `null` si sí; si no, por qué. */
async function unavailableReason(userId: string): Promise<{ name: string | null; reason: string | null }> {
  const [client, config] = await Promise.all([findClient({ id: userId }), getAgentChatConfig()]);
  if (!client.ok) {
    return { name: null, reason: "El asistente es para los clientes de Geniorama. Entra con tu cuenta de cliente." };
  }
  if (!client.agentEnabled) {
    return { name: client.client.name, reason: "Tu plan no incluye el asistente. Si quieres activarlo, escríbele al equipo de Geniorama." };
  }
  if (!config.ready) {
    return { name: client.client.name, reason: "El asistente estará disponible muy pronto: el equipo de Geniorama lo está terminando de configurar." };
  }
  return { name: client.client.name, reason: null };
}

/** El estado del chat al abrirlo: si está disponible y la última conversación. */
export async function loadAgentChat(userId: string): Promise<AgentChatState> {
  const { name, reason } = await unavailableReason(userId);
  if (reason) return { available: false, name, reason };

  const last = await prisma.agentChatMessage.findFirst({
    where: { userId }, orderBy: { createdAt: "desc" }, select: { conversationId: true },
  });
  const messages = last
    ? await prisma.agentChatMessage.findMany({
        where: { userId, conversationId: last.conversationId },
        orderBy: { createdAt: "desc" },
        take: RESUME_LIMIT,
        select: { id: true, role: true, content: true, kind: true, createdAt: true },
      })
    : [];
  return {
    available: true,
    name: name ?? "",
    conversationId: last?.conversationId ?? null,
    messages: messages.reverse().map(view),
    audio: audioTranscriptionAvailable(),
  };
}

export type SendResult =
  | { error: string }
  | { conversationId: string; user: AgentChatMessageView; reply: AgentChatMessageView };

/**
 * Manda un mensaje al agente y guarda las dos partes. Sin `conversationId`
 * empieza una conversación nueva. Si el agente no responde, el mensaje no se
 * guarda: se reenvía sin que quede repetido.
 */
export async function sendAgentChat(
  userId: string,
  conversationId: string | null,
  text: string,
  kind: "text" | "audio" = "text",
): Promise<SendResult> {
  const message = text.trim();
  if (!message) return { error: "Escribe un mensaje." };
  // Una nota de voz de dos minutos transcrita pasa de sobra los 2.000 caracteres.
  const max = kind === "audio" ? MAX_MESSAGE * 2 : MAX_MESSAGE;
  if (message.length > max) {
    return { error: kind === "audio" ? "La nota de voz es muy larga. Grábala más corta." : `El mensaje es muy largo (máximo ${max} caracteres).` };
  }

  const { reason } = await unavailableReason(userId);
  if (reason) return { error: reason };

  const recent = await prisma.agentChatMessage.count({
    where: { userId, role: "user", createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= RATE_MAX) return { error: "Enviaste muchos mensajes seguidos. Espera unos minutos e inténtalo de nuevo." };

  // Una conversación ajena no se continúa: se empieza otra.
  let convId = conversationId;
  if (convId) {
    const own = await prisma.agentChatMessage.findFirst({ where: { conversationId: convId, userId }, select: { id: true } });
    if (!own) convId = null;
  }
  convId ??= crypto.randomUUID();

  const history = await prisma.agentChatMessage.findMany({
    where: { conversationId: convId, userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  });

  const userMsg = await prisma.agentChatMessage.create({
    data: { userId, conversationId: convId, role: "user", content: message, kind },
  });

  const r = await askAgent({ userId, conversationId: convId, message, messageType: kind, history: history.reverse() });
  if (!r.ok) {
    await prisma.agentChatMessage.delete({ where: { id: userMsg.id } }).catch(() => {});
    return { error: r.error };
  }

  const reply = await prisma.agentChatMessage.create({
    data: { userId, conversationId: convId, role: "assistant", content: r.reply },
  });
  return { conversationId: convId, user: view(userMsg), reply: view(reply) };
}

/**
 * Una nota de voz: se transcribe y sigue el mismo camino que un mensaje
 * escrito. Las comprobaciones de disponibilidad van antes de transcribir, para
 * no pagar la transcripción de quien no puede usar el asistente.
 */
export async function sendAgentChatAudio(userId: string, conversationId: string | null, file: File): Promise<SendResult> {
  const { reason } = await unavailableReason(userId);
  if (reason) return { error: reason };
  const t = await transcribeAudio(file);
  if (!t.ok) return { error: t.error };
  return sendAgentChat(userId, conversationId, t.text, "audio");
}

// ─── El widget en otros sitios ───────────────────────────────────────────────
//
// Dentro de un iframe en otro dominio la cookie de sesión no llega (los
// navegadores bloquean las cookies de terceros), así que el widget se
// identifica con un token propio: `<userId>.<vence en ms>.<firma>`, firmado con
// AUTH_SECRET. Lo entrega `/embed/conectar` después de que la persona entra con
// su cuenta en una ventana de la plataforma, y vive en el almacenamiento del
// iframe, que el sitio anfitrión no puede leer. Que el usuario siga siendo un
// cliente activo con el asistente se comprueba en cada petición, no al emitirlo.

const EMBED_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function embedSignature(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET no está definida: no se pueden firmar tokens del widget");
  return crypto.createHmac("sha256", secret).update(`agent-embed:${payload}`).digest("base64url");
}

export function issueEmbedToken(userId: string): string {
  const payload = `${userId}.${Date.now() + EMBED_TOKEN_TTL_MS}`;
  return `${payload}.${embedSignature(payload)}`;
}

/** El usuario del token del widget, si es válido y no venció. */
export function verifyEmbedToken(token: string | null | undefined): string | null {
  const parts = (token ?? "").trim().split(".");
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!userId || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  const expected = Buffer.from(embedSignature(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? userId : null;
}

/** Normaliza una lista de orígenes escrita a mano: uno por línea o separados por comas. */
export function parseOrigins(raw: string): string[] {
  const out = new Set<string>();
  for (const part of raw.split(/[\s,]+/)) {
    if (!part) continue;
    try {
      const url = new URL(part.includes("://") ? part : `https://${part}`);
      if (url.protocol === "https:" || url.hostname === "localhost") out.add(url.origin);
    } catch {
      // Lo que no es una URL se descarta.
    }
  }
  return [...out];
}

/** Los sitios autorizados a mostrar el widget. La propia plataforma siempre lo está. */
export async function embedAllowedOrigins(): Promise<string[]> {
  const row = await prisma.appSetting.findUnique({ where: { key: AGENT_CHAT_EMBED_ORIGINS_KEY } });
  return parseOrigins(row?.value ?? "");
}
