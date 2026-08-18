/**
 * Estado de una conversación de WhatsApp.
 *
 * WhatsApp no tiene sesión: cada mensaje llega suelto, con un número y un
 * texto. Todo lo que el agente necesita recordar entre mensajes —los turnos
 * anteriores, la acción que propuso y aún no le confirmaron, y si el número
 * está vinculado a un usuario— vive en la tabla `whatsapp_conversations`.
 */

import { prisma } from "@/lib/prisma";
import { Prisma, type Priority } from "@/generated/prisma";
import type { ChatMsg } from "@/lib/ai";

/** Turnos que se conservan del hilo. Suficiente para el ida y vuelta de
 *  recolectar un ticket sin inflar el prompt en conversaciones largas. */
const MAX_TURNS = 16;

/** Una propuesta caduca: confirmar «sí» tres horas después no debe crear el
 *  ticket que el usuario ya olvidó. */
const PENDING_TTL_MS = 30 * 60 * 1000;

/** Acción irreversible que el agente propuso y espera que el usuario confirme. */
export type PendingAction = {
  kind: "ticket";
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  /** ISO. Sirve para caducar la propuesta. */
  at: string;
};

export type Conversation = {
  id: string;
  phone: string;
  userId: string | null;
  messages: ChatMsg[];
  pending: PendingAction | null;
  verifyCodeHash: string | null;
  verifyUserId: string | null;
  verifyExpiresAt: Date | null;
  verifyAttempts: number;
  blockedUntil: Date | null;
  lastMessageId: string | null;
  lastReply: string | null;
};

function parseMessages(raw: unknown): ChatMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    if (typeof m !== "object" || m === null) return [];
    const { role, text } = m as { role?: unknown; text?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof text !== "string") return [];
    return [{ role, text } as ChatMsg];
  });
}

function parsePending(raw: unknown): PendingAction | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Partial<PendingAction>;
  if (p.kind !== "ticket" || typeof p.titulo !== "string" || typeof p.at !== "string") return null;
  // Caducada: se trata como si no existiera.
  if (Date.now() - new Date(p.at).getTime() > PENDING_TTL_MS) return null;
  return {
    kind: "ticket",
    titulo: p.titulo,
    descripcion: typeof p.descripcion === "string" ? p.descripcion : p.titulo,
    prioridad: (p.prioridad ?? "MEDIA") as Priority,
    at: p.at,
  };
}

/** Carga la conversación del número, creándola en el primer mensaje. */
export async function loadConversation(phone: string): Promise<Conversation> {
  const row = await prisma.whatsappConversation.upsert({
    where: { phone },
    create: { phone },
    update: {},
  });

  return {
    id: row.id,
    phone: row.phone,
    userId: row.userId,
    messages: parseMessages(row.messages),
    pending: parsePending(row.pending),
    verifyCodeHash: row.verifyCodeHash,
    verifyUserId: row.verifyUserId,
    verifyExpiresAt: row.verifyExpiresAt,
    verifyAttempts: row.verifyAttempts,
    blockedUntil: row.blockedUntil,
    lastMessageId: row.lastMessageId,
    lastReply: row.lastReply,
  };
}

/**
 * Cierra el turno: agrega el par pregunta/respuesta al hilo, deja constancia
 * del `messageId` procesado (para que un reintento de n8n no vuelva a correr el
 * agente) y persiste la acción pendiente que haya quedado.
 */
export async function saveTurn(opts: {
  conversationId: string;
  messages: ChatMsg[];
  userText: string;
  reply: string;
  messageId: string | null;
  pending: PendingAction | null;
}): Promise<void> {
  const messages = [
    ...opts.messages,
    { role: "user" as const, text: opts.userText },
    { role: "assistant" as const, text: opts.reply },
  ].slice(-MAX_TURNS);

  await prisma.whatsappConversation.update({
    where: { id: opts.conversationId },
    data: {
      messages,
      // En Prisma, `undefined` en un campo Json conserva el valor anterior; para
      // borrar la propuesta hay que escribir NULL explícitamente con DbNull.
      pending: opts.pending === null ? Prisma.DbNull : (opts.pending as unknown as Prisma.InputJsonValue),
      lastMessageId: opts.messageId,
      lastReply: opts.reply,
    },
  });
}

/**
 * Deja constancia de una respuesta que no forma parte del hilo del agente
 * (los pasos de vinculación: códigos y correos).
 *
 * No toca `messages` a propósito —ese ruido no le sirve al modelo después—
 * pero sí graba `lastMessageId` para que un reintento de n8n no vuelva a
 * disparar el envío del correo con el código.
 */
export async function recordReply(
  conversationId: string,
  messageId: string | null,
  reply: string,
): Promise<void> {
  await prisma.whatsappConversation.update({
    where: { id: conversationId },
    data: { lastMessageId: messageId, lastReply: reply },
  });
}
