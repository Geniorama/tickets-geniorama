import type { ReminderChannel } from "@/generated/prisma";

/**
 * Cómo se llaman los canales.
 *
 * Vive aparte de `channels.ts` a propósito: eso importa el cliente de correo, y
 * los componentes del navegador solo necesitan el nombre. Sin esta separación,
 * pedir la palabra «WhatsApp» se lleva media librería de envío al navegador.
 */
export const CHANNEL_LABELS: Record<ReminderChannel, string> = {
  EMAIL: "Correo",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
};
