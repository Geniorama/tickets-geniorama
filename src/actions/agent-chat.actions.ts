"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { requireCan } from "@/lib/access/can";
import { askAgent } from "@/lib/agent-chat";
import { AGENT_CHAT_API_KEY_KEY, AGENT_CHAT_SECRET_KEY } from "@/lib/agent-chat-keys";
import { recordActivity } from "@/lib/activity/record";
import { PLATFORM_SCOPE } from "@/lib/activity/catalog";

export type AgentChatMessageView = { id: string; role: "user" | "assistant"; content: string; createdAt: string };

const MAX_MESSAGE = 2_000;
/** Cada mensaje cuesta una llamada al modelo: un tope generoso para una persona. */
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 30;

const view = (m: { id: string; role: string; content: string; createdAt: Date }): AgentChatMessageView => ({
  id: m.id,
  role: m.role === "assistant" ? "assistant" : "user",
  content: m.content,
  createdAt: m.createdAt.toISOString(),
});

/**
 * Manda un mensaje del cliente al agente y guarda las dos partes. Sin
 * `conversationId` empieza una conversación nueva. Si el agente no responde,
 * el mensaje no se guarda: el cliente lo reenvía sin que quede repetido.
 */
export async function sendAgentChatMessage(
  conversationId: string | null,
  text: string,
): Promise<{ error: string } | { conversationId: string; user: AgentChatMessageView; reply: AgentChatMessageView }> {
  const session = await getRequiredSession();
  if (session.user.role !== "CLIENTE") return { error: "El asistente es para los clientes de Geniorama." };
  const userId = session.user.id;

  const message = text.trim();
  if (!message) return { error: "Escribe un mensaje." };
  if (message.length > MAX_MESSAGE) return { error: `El mensaje es muy largo (máximo ${MAX_MESSAGE} caracteres).` };

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
    data: { userId, conversationId: convId, role: "user", content: message },
  });

  const r = await askAgent({ userId, conversationId: convId, message, history: history.reverse() });
  if (!r.ok) {
    await prisma.agentChatMessage.delete({ where: { id: userMsg.id } }).catch(() => {});
    return { error: r.error };
  }

  const reply = await prisma.agentChatMessage.create({
    data: { userId, conversationId: convId, role: "assistant", content: r.reply },
  });
  return { conversationId: convId, user: view(userMsg), reply: view(reply) };
}

/** El secreto con que se firman las peticiones al workflow. Se muestra una sola vez. */
export async function generateAgentChatSecret(): Promise<{ error: string } | { secret: string }> {
  const session = await requireCan("ADMIN");
  const secret = crypto.randomBytes(32).toString("base64url");
  try {
    await prisma.appSetting.upsert({
      where: { key: AGENT_CHAT_SECRET_KEY },
      update: { value: secret },
      create: { key: AGENT_CHAT_SECRET_KEY, value: secret },
    });
  } catch {
    return { error: "No se pudo guardar el secreto." };
  }
  recordActivity({
    entityType: "SETTINGS",
    entityId: PLATFORM_SCOPE,
    action: "settings.updated",
    label: AGENT_CHAT_SECRET_KEY,
    meta: { note: "Se generó un secreto nuevo." },
    actor: session.user,
  });
  revalidatePath("/admin/integraciones");
  return { secret };
}

/** Elige la llave del agente para la que se firman los tokens del chat. */
export async function setAgentChatKey(keyId: string): Promise<{ error?: string }> {
  await requireCan("ADMIN");
  const key = await prisma.apiKey.findFirst({ where: { id: keyId, isActive: true, scopes: { has: "agent" }, user: { role: { not: "CLIENTE" } } }, select: { id: true } });
  if (!key) return { error: "Esa llave no existe o no tiene el permiso del agente." };
  await prisma.appSetting.upsert({
    where: { key: AGENT_CHAT_API_KEY_KEY },
    update: { value: keyId },
    create: { key: AGENT_CHAT_API_KEY_KEY, value: keyId },
  });
  revalidatePath("/admin/integraciones");
  return {};
}
