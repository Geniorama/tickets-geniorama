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
import { findClient, issueClientToken } from "@/lib/api/agent";

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

/** ¿Se le ofrece el chat a este cliente? Plan con el agente y canal configurado. */
export async function agentChatAvailableFor(userId: string): Promise<boolean> {
  const [client, config] = await Promise.all([findClient({ id: userId }), getAgentChatConfig()]);
  return client.ok && client.agentEnabled && config.ready;
}

/**
 * n8n responde con lo que devuelva el nodo «Respond to Webhook». Se aceptan
 * las formas habituales: `{ reply }`, `{ output }` (la salida del AI Agent),
 * `{ text }`, una lista con cualquiera de ellas o texto plano.
 */
function extractReply(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return text;
  }
  const first = Array.isArray(data) ? data[0] : data;
  if (typeof first === "string") return first;
  if (first && typeof first === "object") {
    for (const field of ["reply", "output", "text", "message"]) {
      const v = (first as Record<string, unknown>)[field];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
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
  history: { role: string; content: string }[];
}): Promise<AskResult> {
  const config = await readConfig();
  if (!config.url || !config.secret || !config.key) {
    return { ok: false, error: "El asistente todavía no está configurado. Avísale al equipo de Geniorama." };
  }

  const found = await findClient({ id: input.userId });
  if (!found.ok) return { ok: false, error: "No encontramos tu cuenta de cliente." };
  if (!found.agentEnabled) return { ok: false, error: "Tu plan no incluye el asistente." };

  const { client } = found;
  const token = issueClientToken(config.key.id, client.id);
  const sentAt = new Date().toISOString();
  const body = JSON.stringify({
    channel: "web",
    conversationId: input.conversationId,
    message: input.message,
    history: input.history.slice(-HISTORY_LIMIT),
    client: { id: client.id, name: client.name, email: client.email, companies: client.companies },
    clientToken: token.token,
    clientTokenExpiresAt: token.expiresAt,
    sentAt,
  });

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
