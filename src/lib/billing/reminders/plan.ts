import type { BillingStatus, ReminderChannel } from "@/generated/prisma";
import { isInvoiced, pendiente } from "@/lib/billing/status";

/**
 * Qué hay que enviar hoy.
 *
 * Todo esto es una función pura a propósito: decide a quién se le escribe
 * sobre su dinero, y eso hay que poder probarlo sin base de datos, sin red y
 * sin mandarle nada a nadie.
 */

export type Regla = {
  id: string;
  offsetDays: number;
  channels: ReminderChannel[];
  /** Desde cuándo cuenta. Ver `activeSince` en el esquema. */
  activeSince: Date;
};

export type Cobro = {
  id: string;
  status: BillingStatus;
  amount: number;
  paidAmount: number;
  invoiceDueDate: Date | null;
  remindersOff: boolean;
};

export type Envio = { reglaId: string; cobroId: string; channel: ReminderChannel; dias: number };

/** Días entre el vencimiento y hoy, a día completo. Negativo si aún no vence. */
export function diasVencido(vencimiento: Date, hoy: Date): number {
  const dia = 24 * 60 * 60 * 1000;
  const aMedianoche = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((aMedianoche(hoy) - aMedianoche(vencimiento)) / dia);
}

/**
 * Un cobro entra en el juego si hay factura emitida, queda dinero por entrar,
 * tiene vencimiento y nadie lo ha silenciado.
 *
 * Lo no emitido queda fuera aunque tenga fecha: reclamar el pago de algo que
 * todavía no se ha facturado es pedirle a alguien que pague lo que no ha
 * recibido.
 */
export function seLePuedeReclamar(c: Cobro): boolean {
  return (
    !c.remindersOff &&
    c.invoiceDueDate !== null &&
    isInvoiced(c.status) &&
    pendiente(c.amount, c.paidAmount) > 0
  );
}

/**
 * Los envíos que tocan hoy.
 *
 * `yaEnviado` responde si esa combinación de regla, cobro y canal ya salió
 * alguna vez; en la base lo garantiza además un índice único parcial, porque
 * un recordatorio duplicado no se puede deshacer.
 *
 * El umbral es «lleva al menos N días» y no «hoy hace exactamente N»: si el
 * cron no corre un día —falla la red, se cae el servidor—, con la igualdad ese
 * aviso se perdería para siempre. Con el umbral se manda al día siguiente, y
 * que no se repita ya lo resuelve `yaEnviado`.
 */
export function planificar({
  reglas,
  cobros,
  hoy,
  yaEnviado,
}: {
  reglas: Regla[];
  cobros: Cobro[];
  hoy: Date;
  yaEnviado: (reglaId: string, cobroId: string, channel: ReminderChannel) => boolean;
}): Envio[] {
  const envios: Envio[] = [];

  for (const cobro of cobros) {
    if (!seLePuedeReclamar(cobro)) continue;
    const dias = diasVencido(cobro.invoiceDueDate!, hoy);

    for (const regla of reglas) {
      if (dias < regla.offsetDays) continue;

      // El día en que a este cobro le tocaba esta regla. Si cae antes de que
      // la regla existiera, no se manda: encender una regla no debe soltar de
      // golpe un mensaje por cada factura vencida del último año.
      const objetivo = new Date(cobro.invoiceDueDate!);
      objetivo.setDate(objetivo.getDate() + regla.offsetDays);
      if (diasVencido(regla.activeSince, objetivo) < 0) continue;

      for (const channel of regla.channels) {
        if (yaEnviado(regla.id, cobro.id, channel)) continue;
        envios.push({ reglaId: regla.id, cobroId: cobro.id, channel, dias });
      }
    }
  }

  return envios;
}

export type ContactoPosible = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

export type Destinatario = {
  /** A dónde va. Puede ser más de uno si la empresa tiene buzón de facturación. */
  emails: string[];
  /** Con qué nombre se le habla: la persona, o la empresa si es un buzón. */
  nombre: string;
  /** Para SMS y WhatsApp. Un buzón de correo no tiene teléfono. */
  phone: string | null;
  /** De dónde salió, para poder explicarlo en pantalla. */
  origen: "facturacion" | "contacto";
};

export type Cuenta = {
  nombre: string;
  /** Los buzones de facturación de la empresa. Ver `Company.billingEmails`. */
  billingEmails: string[];
  contactos: ContactoPosible[];
};

/**
 * A quién se le reclama.
 *
 * Manda el buzón de facturación de la empresa si lo tiene: quien lo rellenó
 * está diciendo explícitamente a dónde van las facturas, y eso gana sobre
 * cualquier deducción nuestra. Suele ser `facturacion@cliente.com`, un sitio
 * donde no hay una persona sino un departamento.
 *
 * Sin buzón se cae al contacto principal de la cuenta. Y si no hay principal
 * pero hay varios contactos activos, **no se manda nada**: es preferible que
 * alguien entre y lo marque a escribirle a cinco personas de la misma empresa
 * sobre una deuda. Con un solo contacto activo no hay ambigüedad.
 */
export function destinatarioDe(cuenta: Cuenta): { destinatario: Destinatario } | { motivo: string } {
  const buzones = cuenta.billingEmails.map((e) => e.trim()).filter(Boolean);
  if (buzones.length > 0) {
    return {
      destinatario: {
        emails: buzones,
        // Un buzón genérico no tiene nombre de pila; se le habla a la empresa.
        nombre: cuenta.nombre,
        // Si además hay contacto principal con teléfono, sirve para SMS.
        phone: cuenta.contactos.find((c) => c.isActive && c.isPrimary)?.phone ?? null,
        origen: "facturacion",
      },
    };
  }

  const activos = cuenta.contactos.filter((c) => c.isActive && c.email.trim() !== "");
  if (activos.length === 0) {
    return { motivo: "La empresa no tiene buzón de facturación ni contactos activos con correo" };
  }

  const principal = activos.find((c) => c.isPrimary);
  const elegido = principal ?? (activos.length === 1 ? activos[0] : null);
  if (!elegido) {
    return {
      motivo: "Hay varios contactos y ninguno marcado como principal. Pon un correo de facturación en la empresa o marca el contacto principal",
    };
  }

  return {
    destinatario: {
      emails: [elegido.email],
      nombre: [elegido.firstName, elegido.lastName].filter(Boolean).join(" "),
      phone: elegido.phone,
      origen: "contacto",
    },
  };
}
