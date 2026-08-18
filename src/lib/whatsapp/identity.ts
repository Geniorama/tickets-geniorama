/**
 * Quién está del otro lado del WhatsApp.
 *
 * Esta parte es deliberadamente determinista: no pasa por el modelo. Decidir si
 * un número tiene derecho a ver los tickets y el plan de una empresa es una
 * regla de seguridad, y una regla de seguridad no se delega en un texto
 * generado. El modelo solo entra en escena cuando el número ya está vinculado.
 *
 * La fuente de verdad del vínculo es `User.whatsappPhone` (índice único), no la
 * conversación: así el admin puede cargar el número a mano desde la ficha del
 * usuario y el bot lo reconoce sin flujo de verificación.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendWhatsappCodeEmail } from "@/lib/email";
import { formatPhone } from "@/lib/whatsapp/phone";
import type { Conversation } from "@/lib/whatsapp/conversation";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 30 * 60 * 1000;
/** Espera mínima entre dos envíos de código al mismo hilo. */
const RESEND_COOLDOWN_MS = 60 * 1000;

/** Cuándo se emitió el código vigente, deducido de su caducidad. */
function issuedAt(conv: Conversation): number | null {
  if (!conv.verifyExpiresAt) return null;
  return conv.verifyExpiresAt.getTime() - CODE_TTL_MS;
}

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CODE_REGEX = /\b(\d{6})\b/;

/**
 * Respuesta genérica al pedir un código. Es la misma exista o no el correo: si
 * cambiara, cualquiera podría averiguar qué direcciones tienen cuenta mandando
 * mensajes al bot.
 */
const CODE_SENT_REPLY =
  "Si ese correo corresponde a una cuenta activa, te acabo de enviar un código de 6 dígitos. " +
  "Respóndeme aquí con el código para vincular este número. Caduca en 10 minutos.";

const ASK_EMAIL_REPLY =
  "¡Hola! Soy el asistente de Geniorama. 👋\n\n" +
  "Este número todavía no está vinculado a ninguna cuenta, así que no puedo consultar tickets ni planes.\n\n" +
  "Escríbeme el *correo con el que ingresas a la plataforma* y te envío un código para vincularlo.";

export type IdentityResult =
  /** Número vinculado: sigue el agente. */
  | { kind: "authenticated"; userId: string }
  /** El flujo de vinculación ya resolvió el turno; esta es la respuesta. */
  | { kind: "reply"; text: string };

/** Usuario dueño del número, si lo hay y sigue activo. */
export async function findUserByPhone(phone: string) {
  return prisma.user.findFirst({
    where: { whatsappPhone: phone, isActive: true },
    select: { id: true, name: true, role: true },
  });
}

/**
 * Resuelve la identidad del número. Si ya está vinculado devuelve el usuario;
 * si no, conduce el flujo de vinculación y devuelve el texto a responder.
 */
export async function resolveIdentity(
  conv: Conversation,
  text: string,
): Promise<IdentityResult> {
  const user = await findUserByPhone(conv.phone);
  if (user) {
    // Mantiene sincronizado el enlace de la conversación con el del usuario.
    if (conv.userId !== user.id) {
      await prisma.whatsappConversation.update({
        where: { id: conv.id },
        data: { userId: user.id },
      });
    }
    return { kind: "authenticated", userId: user.id };
  }

  if (conv.blockedUntil && conv.blockedUntil > new Date()) {
    return {
      kind: "reply",
      text:
        "Has fallado el código demasiadas veces. Vuelve a intentarlo en un rato " +
        "o pídele a tu agente que registre este número desde la plataforma.",
    };
  }

  // ── Está respondiendo con un código ──
  const codeMatch = text.match(CODE_REGEX);
  if (codeMatch && conv.verifyCodeHash && conv.verifyUserId) {
    return verifyCode(conv, codeMatch[1]);
  }

  // ── Está mandando su correo ──
  const emailMatch = text.match(EMAIL_REGEX);
  if (emailMatch) {
    // Enfriamiento: sin él, repetir el correo de otra persona en el chat sería
    // una forma cómoda de inundarle la bandeja de entrada.
    if (issuedAt(conv) !== null && Date.now() - issuedAt(conv)! < RESEND_COOLDOWN_MS) {
      return {
        kind: "reply",
        text: "Ya te envié un código hace un momento. Revisa tu correo (mira también en spam) y respóndeme con los 6 dígitos.",
      };
    }
    await startVerification(conv, emailMatch[0].toLowerCase());
    return { kind: "reply", text: CODE_SENT_REPLY };
  }

  // ── No entendemos qué quiere: pedimos el correo ──
  return { kind: "reply", text: ASK_EMAIL_REPLY };
}

/**
 * Genera y envía el código. No revela si el correo existe: cuando no hay
 * usuario, limpia el estado y sale en silencio — el endpoint responde igual.
 */
async function startVerification(conv: Conversation, email: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { email, isActive: true },
    select: { id: true, name: true, email: true, whatsappPhone: true },
  });

  if (!user) {
    await prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: { verifyCodeHash: null, verifyUserId: null, verifyExpiresAt: null },
    });
    return;
  }

  // El código llega al correo del titular, así que si alguien intenta secuestrar
  // una cuenta desde otro número, el dueño se entera por email.
  const code = String(Math.floor(100000 + Math.random() * 900000));

  await prisma.whatsappConversation.update({
    where: { id: conv.id },
    data: {
      verifyCodeHash: await bcrypt.hash(code, 10),
      verifyUserId: user.id,
      verifyExpiresAt: new Date(Date.now() + CODE_TTL_MS),
      verifyAttempts: 0,
    },
  });

  try {
    await sendWhatsappCodeEmail(
      { name: user.name, email: user.email },
      code,
      formatPhone(conv.phone),
      user.whatsappPhone ? formatPhone(user.whatsappPhone) : null,
    );
  } catch (err) {
    console.error("[whatsapp] Error enviando código de vinculación:", err);
  }
}

/** Comprueba el código y, si acierta, deja el número atado al usuario. */
async function verifyCode(conv: Conversation, code: string): Promise<IdentityResult> {
  const expired = !conv.verifyExpiresAt || conv.verifyExpiresAt < new Date();
  if (expired) {
    return {
      kind: "reply",
      text: "Ese código ya caducó. Mándame otra vez tu correo y te envío uno nuevo.",
    };
  }

  const ok = await bcrypt.compare(code, conv.verifyCodeHash!);

  if (!ok) {
    const attempts = conv.verifyAttempts + 1;
    const blocked = attempts >= MAX_ATTEMPTS;
    await prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: {
        verifyAttempts: attempts,
        ...(blocked
          ? {
              blockedUntil: new Date(Date.now() + BLOCK_MS),
              verifyCodeHash: null,
              verifyUserId: null,
              verifyExpiresAt: null,
              verifyAttempts: 0,
            }
          : {}),
      },
    });
    return {
      kind: "reply",
      text: blocked
        ? "Código incorrecto. Has agotado los intentos; prueba de nuevo en media hora."
        : `Código incorrecto. Te quedan ${MAX_ATTEMPTS - attempts} intento(s).`,
    };
  }

  const target = await prisma.user.findFirst({
    where: { id: conv.verifyUserId!, isActive: true },
    select: { id: true, name: true },
  });
  if (!target) {
    return { kind: "reply", text: "Esa cuenta ya no está activa. Contacta a tu agente." };
  }

  // Un número, un usuario: el índice único de `whatsappPhone` lo garantiza, y
  // el `updateMany` previo suelta el número de cualquier cuenta anterior.
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { whatsappPhone: conv.phone, NOT: { id: target.id } },
      data: { whatsappPhone: null },
    }),
    prisma.user.update({
      where: { id: target.id },
      data: { whatsappPhone: conv.phone },
    }),
    prisma.whatsappConversation.update({
      where: { id: conv.id },
      data: {
        userId: target.id,
        verifyCodeHash: null,
        verifyUserId: null,
        verifyExpiresAt: null,
        verifyAttempts: 0,
        blockedUntil: null,
      },
    }),
  ]);

  return {
    kind: "reply",
    text:
      `¡Listo, ${target.name}! Este número quedó vinculado a tu cuenta. ✅\n\n` +
      "Desde aquí puedes:\n" +
      "• *Crear un ticket* — cuéntame qué necesitas\n" +
      "• *Consultar tus tickets* — «¿cómo va mi ticket?»\n" +
      "• *Ver tu plan* — «¿cuántas horas me quedan?»\n" +
      "• *Comentar un ticket* — «en el ACM-12, agrega que…»",
  };
}
