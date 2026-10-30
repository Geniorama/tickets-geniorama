/**
 * El chat con el agente de atención dentro de la plataforma.
 *
 * Es otro canal del mismo agente de n8n, no un agente nuevo: la plataforma
 * pone la ventana de chat y guarda la conversación, y cada mensaje se reenvía
 * a un webhook del workflow, que responde con el texto. El modelo, el tono y
 * las herramientas siguen viviendo allá (ver la v1.66 y `src/lib/api/agent.ts`).
 *
 * Lo que cambia frente a WhatsApp es quién identifica al cliente. Allá lo hace
 * el número; aquí ya hay sesión, así que la plataforma entrega directamente el
 * `clientToken` (el mismo de `/agent/client`, firmado para la llave del
 * agente). El workflow lo usa tal cual en las herramientas y nunca necesita
 * preguntar quién escribe: aunque alguien llamara al webhook por su cuenta, sin
 * un token firmado aquí no podría leer los datos de nadie.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findClient, issueClientToken, type AgentClient } from "@/lib/api/agent";
import { isStaff } from "@/lib/roles";

import { AGENT_CHAT_URL_KEY, AGENT_CHAT_SECRET_KEY, AGENT_CHAT_API_KEY_KEY } from "@/lib/agent-chat-keys";

/** Lo que el agente recibe de la conversación previa a cada mensaje. */
const HISTORY_LIMIT = 20;
/** El agente puede consultar varias herramientas antes de contestar. */
const TIMEOUT_MS = 90_000;
const MAX_REPLY = 8_000;

export type AgentChatConfig = {
  url: string | null;
  secretConfigured: boolean;
  /** La llave elegida, si existe y sigue activa. */
  key: { id: string; label: string } | null;
  /** Todas las llaves del equipo con el permiso `agent`, para elegir. */
  keys: { id: string; label: string }[];
  ready: boolean;
};

async function agentKeys() {
  const keys = await prisma.apiKey.findMany({
    where: {
      scopes: { has: "agent" },
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      user: { role: { not: "CLIENTE" } },
    },
    select: { id: true, label: true },
    orderBy: { createdAt: "asc" },
  });
  return keys;
}

async function readConfig() {
  const [rows, keys] = await Promise.all([
    prisma.appSetting.findMany({
      where: { key: { in: [AGENT_CHAT_URL_KEY, AGENT_CHAT_SECRET_KEY, AGENT_CHAT_API_KEY_KEY] } },
    }),
    agentKeys(),
  ]);
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value.trim()]));
  const chosen = keys.find((k) => k.id === s[AGENT_CHAT_API_KEY_KEY]) ?? keys[0] ?? null;
  return { url: s[AGENT_CHAT_URL_KEY] || null, secret: s[AGENT_CHAT_SECRET_KEY] || null, key: chosen, keys };
}

export async function getAgentChatConfig(): Promise<AgentChatConfig> {
  const c = await readConfig();
  return {
    url: c.url,
    secretConfigured: Boolean(c.secret),
    key: c.key,
    keys: c.keys,
    ready: Boolean(c.url && c.secret && c.key && process.env.AUTH_SECRET?.trim()),
  };
}

/** Quien habla con el agente: un cliente (con su plan) o alguien del equipo. */
export type AgentUser =
  | { kind: "client"; name: string; agentEnabled: boolean; client: AgentClient }
  | { kind: "staff"; name: string; user: { id: string; name: string; email: string; role: string } };

/** El usuario como el agente lo atiende; `null` si no es cliente activo ni del equipo. */
export async function findAgentUser(userId: string): Promise<AgentUser | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;
  if (isStaff(user.role)) return { kind: "staff", name: user.name, user };
  const found = await findClient({ id: userId });
  if (!found.ok) return null;
  return { kind: "client", name: found.client.name, agentEnabled: found.agentEnabled, client: found.client };
}

/** ¿Se le ofrece el chat? Al equipo siempre; al cliente, con el agente en su plan. Con el canal configurado. */
export async function agentChatAvailableFor(userId: string): Promise<boolean> {
  const [who, config] = await Promise.all([findAgentUser(userId), getAgentChatConfig()]);
  if (!who || !config.ready) return false;
  return who.kind === "staff" || who.agentEnabled;
}

/**
 * n8n responde con lo que devuelva el nodo «Respond to Webhook». Se aceptan
 * las formas habituales: `{ reply }`, `{ output }` (la salida del AI Agent),
 * `{ text }`, una lista con cualquiera de ellas o texto plano.
 *
 * Con Claude y herramientas, el AI Agent a veces entrega `output` no como
 * texto sino como los bloques de contenido del modelo
 * (`[{ type: "text", text: "…" }, { type: "tool_use", … }]`); se juntan los
 * de texto. Sin esto, una respuesta válida llegaba como «vacía».
 */
const REPLY_FIELDS = ["reply", "output", "text", "message", "content"] as const;

function textOf(value: unknown, depth = 0): string | null {
  if (depth > 4 || value == null) return null;
  if (typeof value === "string") return value.trim() ? value : null;
  if (Array.isArray(value)) {
    const parts = value
      .filter((v) => !(v && typeof v === "object" && "type" in v && (v as { type: unknown }).type !== "text"))
      .map((v) => textOf(v, depth + 1))
      .filter((v): v is string => Boolean(v));
    return parts.length ? parts.join("\n\n") : null;
  }
  if (typeof value === "object") {
    for (const field of REPLY_FIELDS) {
      const found = textOf((value as Record<string, unknown>)[field], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function extractReply(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return textOf(JSON.parse(text));
  } catch {
    return text;
  }
}

export type AskResult = { ok: true; reply: string } | { ok: false; error: string };

/**
 * Manda un mensaje al workflow y devuelve su respuesta. La petición va firmada
 * como los hooks (`X-Geniorama-Signature: sha256=<hmac del cuerpo>`), con el
 * secreto del canal: el workflow debe comprobarla antes de usar el token.
 */
export async function askAgent(input: {
  userId: string;
  conversationId: string;
  message: string;
  /** "audio": `message` es la transcripción de una nota de voz. */
  messageType?: "text" | "audio";
  history: { role: string; content: string }[];
}): Promise<AskResult> {
  const config = await readConfig();
  if (!config.url || !config.secret || !config.key) {
    return { ok: false, error: "El asistente todavía no está configurado. Avísale al equipo de Geniorama." };
  }

  const who = await findAgentUser(input.userId);
  if (!who) return { ok: false, error: "No encontramos tu cuenta." };
  if (who.kind === "client" && !who.agentEnabled) return { ok: false, error: "Tu plan no incluye el asistente." };

  const sentAt = new Date().toISOString();
  const common = {
    channel: "web",
    conversationId: input.conversationId,
    message: input.message,
    messageType: input.messageType ?? "text",
    history: input.history.slice(-HISTORY_LIMIT),
    sentAt,
  };
  // El equipo no lleva `clientToken`: su identidad viaja en el cuerpo firmado y
  // el workflow usa las herramientas del equipo (API v1 con la llave del agente).
  let payload: Record<string, unknown>;
  if (who.kind === "staff") {
    payload = { ...common, audience: "staff", user: who.user };
  } else {
    const { client } = who;
    const token = issueClientToken(config.key.id, client.id);
    payload = {
      ...common,
      audience: "client",
      client: { id: client.id, name: client.name, email: client.email, companies: client.companies },
      clientToken: token.token,
      clientTokenExpiresAt: token.expiresAt,
    };
  }
  const body = JSON.stringify(payload);

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Geniorama-AgentChat/1.0",
        "X-Geniorama-Timestamp": sentAt,
        "X-Geniorama-Signature": `sha256=${crypto.createHmac("sha256", config.secret).update(body).digest("hex")}`,
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    console.error("[agent-chat] fallo al llamar al webhook", e);
    return {
      ok: false,
      error: timedOut
        ? "El asistente tardó demasiado en responder. Inténtalo de nuevo."
        : "No pudimos comunicarnos con el asistente. Inténtalo en un momento.",
    };
  }

  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    console.error(`[agent-chat] el webhook respondió ${res.status}: ${raw.slice(0, 300)}`);
    return { ok: false, error: "El asistente no pudo responder ahora. Inténtalo en un momento." };
  }
  const reply = extractReply(raw);
  if (!reply) {
    console.error(`[agent-chat] respuesta sin texto: ${raw.slice(0, 300)}`);
    return { ok: false, error: "El asistente respondió vacío. Inténtalo de nuevo." };
  }
  return { ok: true, reply: reply.trim().slice(0, MAX_REPLY) };
}
