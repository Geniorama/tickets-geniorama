import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/crm/phone";

/**
 * Conversación del agente por canal externo. Se guarda por teléfono (E.164) y
 * se devuelve como `history` en el formato que espera un LLM: role/content.
 */

export const HISTORY_DEFAULT = 20;
export const HISTORY_MAX = 50;

/** WhatsApp manda el número sin «+»; aquí se deja siempre en E.164. */
export function phoneToE164(raw: string): { ok: true; e164: string } | { ok: false; error: string } {
  const digits = raw.replace(/[^\d+]/g, "");
  return normalizePhone(digits.startsWith("+") ? digits : `+${digits}`);
}

export async function recentHistory(phone: string, limit = HISTORY_DEFAULT) {
  const rows = await prisma.agentMessage.findMany({
    where: { channel: "WHATSAPP", phone },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), HISTORY_MAX),
    select: { direction: true, content: true, createdAt: true },
  });
  return rows.reverse().map((m) => ({
    role: m.direction === "IN" ? ("user" as const) : ("assistant" as const),
    content: m.content,
    at: m.createdAt.toISOString(),
  }));
}

export async function saveMessage(input: {
  phone: string; direction: "IN" | "OUT"; content: string; waMessageId?: string | null; clientId?: string | null;
  error?: string | null;
}) {
  const data = {
    channel: "WHATSAPP" as const,
    phone: input.phone,
    direction: input.direction,
    content: input.content,
    waMessageId: input.waMessageId || null,
    clientId: input.clientId ?? null,
    error: input.error || null,
  };
  // Meta reintenta los webhooks: el mismo wamid no se guarda dos veces.
  if (data.waMessageId) {
    const ya = await prisma.agentMessage.findUnique({ where: { waMessageId: data.waMessageId }, select: { id: true } });
    if (ya) return { id: ya.id, duplicate: true };
    try {
      const m = await prisma.agentMessage.create({ data, select: { id: true } });
      return { id: m.id, duplicate: false };
    } catch (e) {
      // Carrera entre dos reintentos simultáneos: gana el índice único.
      if ((e as { code?: string }).code === "P2002") {
        const otra = await prisma.agentMessage.findUnique({ where: { waMessageId: data.waMessageId }, select: { id: true } });
        if (otra) return { id: otra.id, duplicate: true };
      }
      throw e;
    }
  }
  const m = await prisma.agentMessage.create({ data, select: { id: true } });
  return { id: m.id, duplicate: false };
}
