import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { loadConversation, recordReply, saveTurn } from "@/lib/whatsapp/conversation";
import { resolveIdentity } from "@/lib/whatsapp/identity";
import { runWhatsappAgent } from "@/lib/whatsapp/agent";

/**
 * Agente de tickets por WhatsApp.
 *
 * n8n es el cartero: recibe el mensaje de WhatsApp, lo reenvía aquí y manda de
 * vuelta al usuario el texto que devuelve este endpoint. Toda la conversación
 * —memoria, identidad, propuestas pendientes— vive en la app, no en el
 * workflow: así el bot se comporta igual venga de donde venga el mensaje, y
 * cambiar de proveedor de WhatsApp no obliga a reconstruir el agente.
 *
 * Contrato con n8n:
 *
 *   POST /api/integrations/whatsapp
 *   Authorization: Bearer <INTEGRATION_WHATSAPP_TOKEN>
 *   { "from": "573001234567", "text": "se cayó la web", "messageId": "wamid.HB..." }
 *
 *   → 200 { "ok": true, "reply": "…", "linked": true }
 *
 * `reply` es siempre un texto listo para enviar tal cual. Si algo falla del
 * lado de la app, `reply` trae igualmente un mensaje presentable: el usuario
 * nunca debe quedarse sin respuesta por un error nuestro.
 */

export const dynamic = "force-dynamic";

/** Un mensaje de WhatsApp no llega a esto ni de lejos; corta payloads absurdos. */
const MAX_TEXT_CHARS = 2000;

const payloadSchema = z.object({
  /** Número del remitente. Se acepta con o sin «+», con espacios o guiones. */
  from: z.string().min(6, "from es requerido"),
  /** Texto del mensaje. n8n debe transcribir o descartar audio/imagen antes. */
  text: z.string().default(""),
  /**
   * Id del mensaje en WhatsApp (`wamid…`). Opcional pero muy recomendable: con
   * él, un reintento de n8n devuelve la misma respuesta en vez de volver a
   * correr el agente y, por ejemplo, crear el ticket dos veces.
   */
  messageId: z.string().min(1).max(191).optional(),
});

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function verifyAuth(req: Request): boolean {
  // Trim: tolera un salto de línea accidental en la variable de entorno, que
  // si no provocaría un 401 silencioso (la comparación mira la longitud).
  const expected = process.env.INTEGRATION_WHATSAPP_TOKEN?.trim();
  if (!expected) return false;

  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!verifyAuth(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const phone = normalizePhone(parsed.data.from);
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: `No pude interpretar el número "${parsed.data.from}"` },
      { status: 400 },
    );
  }

  const messageId = parsed.data.messageId ?? null;
  const text = parsed.data.text.trim().slice(0, MAX_TEXT_CHARS);

  const conv = await loadConversation(phone);

  // Reintento de n8n sobre un mensaje ya atendido: se repite la respuesta sin
  // volver a ejecutar nada.
  if (messageId && conv.lastMessageId === messageId && conv.lastReply) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      reply: conv.lastReply,
      phone,
      linked: conv.userId !== null,
    });
  }

  // Mensaje sin texto: audio, imagen, ubicación o sticker que n8n no convirtió.
  if (!text) {
    return NextResponse.json({
      ok: true,
      reply:
        "Por ahora solo entiendo mensajes de texto 🙏 Cuéntame por escrito qué necesitas y lo gestiono.",
      phone,
      linked: conv.userId !== null,
    });
  }

  try {
    // Quién escribe se decide primero y sin IA: un número sin vincular no llega
    // al agente ni ve un solo dato.
    const identity = await resolveIdentity(conv, text);

    if (identity.kind === "reply") {
      // El flujo de vinculación no alimenta la memoria del hilo —son códigos y
      // correos, ruido que no aporta nada al agente después— pero sí queda
      // registrado para que un reintento no reenvíe el correo del código.
      await recordReply(conv.id, messageId, identity.text);
      return NextResponse.json({ ok: true, reply: identity.text, phone, linked: false });
    }

    const outcome = await runWhatsappAgent(identity.userId, conv, text);

    await saveTurn({
      conversationId: conv.id,
      messages: conv.messages,
      userText: text,
      reply: outcome.reply,
      messageId,
      pending: outcome.pending,
    });

    return NextResponse.json({ ok: true, reply: outcome.reply, phone, linked: true });
  } catch (err) {
    console.error("[whatsapp] Error procesando mensaje:", err);
    // 200 a propósito: n8n ya tiene un texto que enviar y reintentar no
    // arreglaría nada. El error queda en los logs del servidor.
    return NextResponse.json({
      ok: false,
      reply:
        "Tuve un problema al procesar tu mensaje 😕 Inténtalo de nuevo en un momento, " +
        "o escríbele directamente a tu agente si es urgente.",
      phone,
      linked: conv.userId !== null,
    });
  }
}
