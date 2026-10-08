import { pendiente } from "@/lib/billing/status";
import { destinatarioDe, diasVencido, type Cuenta } from "@/lib/billing/reminders/plan";
import type { DatosCorreo } from "@/lib/billing/reminders/template";

/**
 * Con qué se arma un correo mandado a mano: a quién puede ir y qué datos del
 * cobro puede citar.
 *
 * Puro a propósito, como el planificador de recordatorios: lo usa el servidor
 * al enviar y el navegador para enseñar, antes de pulsar nada, el texto tal y
 * como lo va a leer el cliente.
 */

const TZ = "America/Bogota";

export type Direccion = {
  email: string;
  /** De quién es, para enseñarlo junto a la casilla. */
  quien: string;
  /** Nombre completo si es una persona; vacío si es un buzón de la empresa. */
  nombre: string | null;
};

const limpio = (e: string) => e.trim().toLowerCase();

/**
 * Las direcciones a las que se le puede escribir a esta empresa: sus buzones
 * de facturación y sus contactos activos.
 *
 * No hay campo libre de «para» y no es un descuido: esto sale desde el correo
 * de administración con el texto que alguien escribió, y limitarlo a lo que
 * está en la ficha del cliente impide que acabe en cualquier parte. Si falta
 * una dirección, se añade en el CRM y aparece aquí.
 */
export function direccionesDe(cuenta: Cuenta): Direccion[] {
  const vistas = new Set<string>();
  const lista: Direccion[] = [];

  for (const e of cuenta.billingEmails) {
    const email = limpio(e);
    if (!email || vistas.has(email)) continue;
    vistas.add(email);
    lista.push({ email, quien: "Buzón de facturación", nombre: null });
  }

  for (const c of cuenta.contactos) {
    const email = limpio(c.email);
    if (!c.isActive || !email || vistas.has(email)) continue;
    vistas.add(email);
    const nombre = [c.firstName, c.lastName].filter(Boolean).join(" ");
    lista.push({ email, quien: c.isPrimary ? `${nombre} · contacto principal` : nombre, nombre });
  }

  return lista;
}

/** Las que salen marcadas: las mismas a las que iría un recordatorio. */
export function direccionesPorDefecto(cuenta: Cuenta): string[] {
  const quien = destinatarioDe(cuenta);
  return "destinatario" in quien ? quien.destinatario.emails.map(limpio) : [];
}

/**
 * Con qué nombre se saluda y a nombre de quién va el correo.
 *
 * Solo se usa el nombre de una persona si el correo va a ella y a nadie más.
 * A un buzón, o a varios a la vez, se le habla a la empresa: «Hola Marta» en
 * un correo que también recibe Luis es peor que no decir ningún nombre.
 */
export function saludoPara(
  direcciones: Direccion[],
  elegidas: string[],
  empresa: string,
): { contacto: string; nombre: string } {
  if (elegidas.length === 1) {
    const unica = direcciones.find((d) => d.email === limpio(elegidas[0]));
    if (unica?.nombre) return { contacto: unica.nombre.split(" ")[0], nombre: unica.nombre };
  }
  return { contacto: empresa, nombre: empresa };
}

/** El día de hoy para quien cobra: el de Bogotá, no el del servidor. */
export function hoyEnBogota(): Date {
  return new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: TZ })}T12:00:00`);
}

export type CobroParaCorreo = {
  concept: string;
  amount: number;
  paidAmount: number;
  invoiceDueDate: Date | null;
  invoiceNumber: string | null;
  company: { name: string };
  /** Basta con el más reciente. */
  payments: { amount: number; paidOn: Date }[];
};

export function datosDeCorreo(
  cobro: CobroParaCorreo,
  contacto: string,
  hoy: Date,
  /** Lo calcula el servidor: aquí no se sabe en qué dominio vive la página. */
  linkPago: string | null = null,
): DatosCorreo {
  const ultimo = cobro.payments[0] ?? null;
  return {
    empresa: cobro.company.name,
    contacto,
    concepto: cobro.concept,
    total: cobro.amount,
    pendiente: pendiente(cobro.amount, cobro.paidAmount),
    vencimiento: cobro.invoiceDueDate,
    dias: cobro.invoiceDueDate ? diasVencido(cobro.invoiceDueDate, hoy) : 0,
    factura: cobro.invoiceNumber,
    abonado: cobro.paidAmount,
    ultimoAbono: ultimo?.amount ?? null,
    fechaAbono: ultimo?.paidOn ?? null,
    linkPago,
  };
}
