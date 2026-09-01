import type { ReminderChannel, ReminderStatus } from "@/generated/prisma";
import { sendBillingReminderEmail } from "@/lib/email";
import type { Destinatario } from "./plan";

/**
 * Por dónde sale un recordatorio.
 *
 * Cada canal es un objeto con las mismas dos preguntas: si está configurado y
 * cómo se manda. Añadir WhatsApp el día que haya cuenta es rellenar el hueco
 * de abajo, sin tocar el planificador ni el cron.
 *
 * Un canal sin configurar no revienta el envío ni bloquea a los demás: devuelve
 * SKIPPED con el motivo, queda en el registro y el correo sale igual.
 */

/**
 * No lleva enlace a propósito: esto lo recibe un cliente, y Facturación no es
 * suya. Si necesita algo, responde al correo y habla con una persona.
 */
export type Mensaje = { asunto: string; cuerpo: string };

export type Resultado = {
  status: ReminderStatus;
  /** El correo o el teléfono que se usó de verdad. */
  recipient: string;
  error?: string;
};

type Canal = {
  /** Qué hace falta en el servidor para que este canal exista. */
  requiere: string[];
  enviar: (a: Destinatario, m: Mensaje) => Promise<Resultado>;
};

const falta = (vars: string[]) => vars.filter((v) => !process.env[v]);

const email: Canal = {
  requiere: ["ZEPTOMAIL_TOKEN", "ZEPTOMAIL_FROM"],
  async enviar(a, m) {
    try {
      await sendBillingReminderEmail({ name: a.nombre, email: a.email }, m);
      return { status: "SENT", recipient: a.email };
    } catch (e) {
      return { status: "FAILED", recipient: a.email, error: (e as Error).message };
    }
  },
};

/**
 * SMS y WhatsApp: el hueco.
 *
 * Falta la cuenta del proveedor, no el sitio donde ponerlo. Cuando la haya,
 * esto es una llamada a su API aquí dentro y las variables de entorno de
 * `requiere`. Para WhatsApp hay además un requisito que no es técnico: Meta
 * exige plantillas aprobadas por ellos para escribirle a alguien que no te ha
 * escrito en las últimas 24 horas, y un aviso de cobro siempre es de esos.
 */
const noConfigurado = (nombre: string, requiere: string[], destino: (a: Destinatario) => string): Canal => ({
  requiere,
  async enviar(a) {
    return {
      status: "SKIPPED",
      recipient: destino(a) || "—",
      error: `${nombre} todavía no está conectado. Falta configurar el proveedor.`,
    };
  },
});

const CANALES: Record<ReminderChannel, Canal> = {
  EMAIL: email,
  SMS: noConfigurado("El envío por SMS", ["SMS_PROVIDER_TOKEN"], (a) => a.phone ?? ""),
  WHATSAPP: noConfigurado("El envío por WhatsApp", ["WHATSAPP_TOKEN"], (a) => a.phone ?? ""),
};

/** Si el servidor tiene lo que hace falta para este canal. */
export function canalDisponible(c: ReminderChannel): boolean {
  return c === "EMAIL" && falta(CANALES.EMAIL.requiere).length === 0;
}

export function loQueFalta(c: ReminderChannel): string[] {
  return falta(CANALES[c].requiere);
}

export async function enviarPor(
  channel: ReminderChannel,
  a: Destinatario,
  m: Mensaje,
): Promise<Resultado> {
  // Los canales que van al móvil necesitan un teléfono; el correo, uno válido.
  if (channel !== "EMAIL" && !a.phone) {
    return { status: "SKIPPED", recipient: "—", error: `${a.nombre} no tiene teléfono guardado` };
  }
  if (channel === "EMAIL" && !canalDisponible("EMAIL")) {
    return {
      status: "SKIPPED",
      recipient: a.email,
      error: `Falta configurar en el servidor: ${loQueFalta("EMAIL").join(", ")}`,
    };
  }
  return CANALES[channel].enviar(a, m);
}
