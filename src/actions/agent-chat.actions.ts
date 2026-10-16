"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { requireCan } from "@/lib/access/can";
import { loadAgentChat, sendAgentChat, parseOrigins, type AgentChatState, type SendResult } from "@/lib/agent-chat-session";
import { AGENT_CHAT_API_KEY_KEY, AGENT_CHAT_SECRET_KEY, AGENT_CHAT_EMBED_ORIGINS_KEY } from "@/lib/agent-chat-keys";
import { recordActivity } from "@/lib/activity/record";
import { PLATFORM_SCOPE } from "@/lib/activity/catalog";

export type { AgentChatMessageView, AgentChatState } from "@/lib/agent-chat-session";

/** El estado del chat para el widget flotante de la plataforma. */
export async function getMyAgentChat(): Promise<AgentChatState> {
  const session = await getRequiredSession();
  return loadAgentChat(session.user.id);
}

/** Un mensaje del cliente con sesión iniciada (página y widget de la plataforma). */
export async function sendAgentChatMessage(conversationId: string | null, text: string): Promise<SendResult> {
  const session = await getRequiredSession();
  if (session.user.role !== "CLIENTE") return { error: "El asistente es para los clientes de Geniorama." };
  return sendAgentChat(session.user.id, conversationId, text);
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

/** Los sitios donde se puede insertar el widget. Devuelve la lista ya normalizada. */
export async function setAgentChatEmbedOrigins(raw: string): Promise<{ error: string } | { origins: string[] }> {
  const session = await requireCan("ADMIN");
  const origins = parseOrigins(raw);
  if (origins.length === 0) {
    await prisma.appSetting.deleteMany({ where: { key: AGENT_CHAT_EMBED_ORIGINS_KEY } });
  } else {
    await prisma.appSetting.upsert({
      where: { key: AGENT_CHAT_EMBED_ORIGINS_KEY },
      update: { value: origins.join("\n") },
      create: { key: AGENT_CHAT_EMBED_ORIGINS_KEY, value: origins.join("\n") },
    });
  }
  recordActivity({
    entityType: "SETTINGS",
    entityId: PLATFORM_SCOPE,
    action: "settings.updated",
    label: AGENT_CHAT_EMBED_ORIGINS_KEY,
    meta: { note: origins.length ? `Sitios autorizados: ${origins.join(", ")}` : "Se quitaron todos los sitios." },
    actor: session.user,
  });
  revalidatePath("/admin/integraciones");
  return { origins };
}
