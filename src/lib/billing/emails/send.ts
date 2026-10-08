import { prisma } from "@/lib/prisma";
import type { BillingEmailStatus } from "@/generated/prisma";
import { pendiente } from "@/lib/billing/status";
import { renderPlantilla, aHtml } from "@/lib/billing/reminders/template";
import { enviarPor } from "@/lib/billing/reminders/channels";
import { datosDeCorreo, direccionesDe, hoyEnBogota, saludoPara } from "./compose";

/**
 * Sacar un correo, sea el que alguien acaba de pulsar o uno que esperaba su
 * hora. Un solo camino para los dos: lo que cambia es quién lo toma.
 */

/** Lo que hay que leer de un cobro para escribirle a su cliente. */
export const COBRO_PARA_CORREO = {
  id: true, concept: true, amount: true, paidAmount: true,
  invoiceDueDate: true, invoiceNumber: true,
  payments: {
    orderBy: { paidOn: "desc" as const },
    take: 1,
    select: { amount: true, paidOn: true },
  },
  company: {
    select: {
      id: true, name: true, billingEmails: true,
      contacts: {
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, isPrimary: true, isActive: true,
        },
      },
    },
  },
};

/**
 * Toma un correo programado para enviarlo.
 *
 * Solo uno puede ganar: si el cron se dispara dos veces, o coincide con
 * alguien cancelándolo, el segundo se encuentra con que ya no está PROGRAMADO
 * y no hace nada. Un correo repetido a un cliente no se puede deshacer.
 */
export async function tomar(id: string): Promise<boolean> {
  const { count } = await prisma.billingEmail.updateMany({
    where: { id, status: "PROGRAMADO" },
    data: { status: "ENVIANDO" },
  });
  return count === 1;
}

/**
 * Envía un correo que ya está tomado (ENVIANDO) y deja apuntado cómo acabó.
 *
 * El texto se sustituye aquí y no al programarlo: «te faltan {{pendiente}}»
 * tiene que decir lo que falta el día que el cliente lo lee.
 */
export async function entregar(id: string): Promise<{ status: BillingEmailStatus; error?: string }> {
  const correo = await prisma.billingEmail.findUnique({
    where: { id },
    select: {
      id: true, status: true, subject: true, body: true, recipients: true,
      onlyIfPending: true, templateName: true, scheduledFor: true, createdById: true,
      billingItem: { select: COBRO_PARA_CORREO },
    },
  });
  if (!correo || correo.status !== "ENVIANDO") {
    return { status: correo?.status ?? "FALLIDO", error: "El correo ya no está pendiente de salir" };
  }

  const cerrar = async (status: BillingEmailStatus, error?: string) => {
    await prisma.billingEmail.update({ where: { id }, data: { status, error } });
    return { status, error };
  };

  const cobro = correo.billingItem;

  if (correo.onlyIfPending && pendiente(cobro.amount, cobro.paidAmount) <= 0) {
    return cerrar("OMITIDO", "El cobro ya no tiene saldo pendiente");
  }

  // Entre programarlo y su hora pueden haber quitado una dirección de la ficha
  // del cliente —alguien que ya no trabaja allí—. A esa ya no se le escribe.
  const direcciones = direccionesDe({
    nombre: cobro.company.name,
    billingEmails: cobro.company.billingEmails,
    contactos: cobro.company.contacts,
  });
  const vigentes = correo.recipients.filter((r) => direcciones.some((d) => d.email === r));
  if (vigentes.length === 0) {
    return cerrar("FALLIDO", "Ninguna de las direcciones elegidas sigue en la ficha del cliente");
  }

  const saludo = saludoPara(direcciones, vigentes, cobro.company.name);
  const datos = datosDeCorreo(cobro, saludo.contacto, hoyEnBogota());
  const asunto = renderPlantilla(correo.subject, datos);
  const cuerpo = renderPlantilla(correo.body, datos);

  const r = await enviarPor(
    "EMAIL",
    { emails: vigentes, nombre: saludo.nombre, phone: null, origen: "facturacion" },
    { asunto, cuerpo: aHtml(cuerpo) },
  );

  if (r.status !== "SENT") {
    return cerrar("FALLIDO", r.error ?? "El correo no salió");
  }

  await prisma.billingEmail.update({
    where: { id },
    // Se guarda lo que se leyó: si mañana cambia el saldo o la plantilla, esto
    // sigue diciendo lo que le llegó al cliente y a qué direcciones.
    data: { status: "ENVIADO", sentAt: new Date(), subject: asunto, body: cuerpo, recipients: vigentes, error: null },
  });

  // En el hilo del cobro, junto a los recordatorios automáticos: quien lo abra
  // ve todo lo que se le ha dicho a este cliente en un solo sitio.
  await prisma.comment.create({
    data: {
      entityType: "BILLING",
      entityId: cobro.id,
      body: `Correo ${correo.scheduledFor ? "programado " : ""}«${correo.templateName ?? asunto}» enviado a ${vigentes.join(", ")}.`,
      authorId: correo.createdById,
      isInternal: true,
    },
  });

  return { status: "ENVIADO" };
}
