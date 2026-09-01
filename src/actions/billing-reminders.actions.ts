"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import type { ReminderChannel } from "@/generated/prisma";
import { marcasDesconocidas } from "@/lib/billing/reminders/template";

/**
 * Las reglas de recordatorio.
 *
 * Todo pide GESTOR: una regla decide qué se le dice a un cliente sobre su
 * dinero y cuándo, sin que nadie vuelva a mirarlo. No es editar un cobro.
 */

const CANALES = ["EMAIL", "SMS", "WHATSAPP"] as const;

const reglaSchema = z.object({
  name: z.string().min(1, "Ponle nombre a la regla").max(120),
  // El rango tiene un porqué: más de un año son datos viejos, y menos de
  // noventa días antes del vencimiento no es un recordatorio, es otra cosa.
  offsetDays: z.number().int().min(-90, "Como mucho 90 días antes").max(365, "Como mucho un año después"),
  channels: z.array(z.enum(CANALES)).min(1, "Elige al menos un canal"),
  subject: z.string().min(1, "El asunto no puede ir vacío").max(200),
  body: z.string().min(1, "Escribe el mensaje").max(4000),
  isActive: z.boolean(),
});

function leer(formData: FormData) {
  return reglaSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    offsetDays: Number(formData.get("offsetDays") ?? 0),
    channels: formData.getAll("channels").map(String),
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    isActive: formData.get("isActive") === "on",
  });
}

/** Una marca mal escrita llegaría al cliente tal cual: se avisa antes. */
function revisarMarcas(subject: string, body: string): string | null {
  const malas = [...new Set([...marcasDesconocidas(subject), ...marcasDesconocidas(body)])];
  if (malas.length === 0) return null;
  return `Estas marcas no existen y se enviarían tal cual: ${malas.map((m) => `{{${m}}}`).join(", ")}`;
}

export async function createReminderRule(formData: FormData) {
  const session = await requireCan("FACTURACION", "gestionar");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const aviso = revisarMarcas(d.subject, d.body);
  if (aviso) return { error: aviso };

  await prisma.billingReminderRule.create({
    data: {
      name: d.name,
      offsetDays: d.offsetDays,
      channels: d.channels as ReminderChannel[],
      subject: d.subject,
      body: d.body,
      isActive: d.isActive,
      createdById: session.user.id,
    },
  });

  revalidatePath("/facturacion/recordatorios");
  return { success: true };
}

export async function updateReminderRule(id: string, formData: FormData) {
  await requireCan("FACTURACION", "gestionar");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const aviso = revisarMarcas(d.subject, d.body);
  if (aviso) return { error: aviso };

  const actual = await prisma.billingReminderRule.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!actual) return { error: "Regla no encontrada" };

  await prisma.billingReminderRule.update({
    where: { id },
    data: {
      name: d.name,
      offsetDays: d.offsetDays,
      channels: d.channels as ReminderChannel[],
      subject: d.subject,
      body: d.body,
      isActive: d.isActive,
      // Volver a encenderla la hace contar desde hoy. Si no, una regla que
      // estuvo apagada tres meses despertaría soltando todo lo atrasado.
      ...(d.isActive && !actual.isActive ? { activeSince: new Date() } : {}),
    },
  });

  revalidatePath("/facturacion/recordatorios");
  return { success: true };
}

export async function toggleReminderRule(id: string, activar: boolean) {
  await requireCan("FACTURACION", "gestionar");

  const { count } = await prisma.billingReminderRule.updateMany({
    where: { id },
    data: { isActive: activar, ...(activar ? { activeSince: new Date() } : {}) },
  });
  if (count === 0) return { error: "Regla no encontrada" };

  revalidatePath("/facturacion/recordatorios");
  return { success: true };
}

export async function deleteReminderRule(id: string) {
  await requireCan("FACTURACION", "gestionar");

  // Los envíos ya hechos sobreviven —`onDelete: SetNull`—: es el historial de
  // lo que se le dijo a un cliente, y no desaparece porque se borre la regla.
  const { count } = await prisma.billingReminderRule.deleteMany({ where: { id } });
  if (count === 0) return { error: "Regla no encontrada" };

  revalidatePath("/facturacion/recordatorios");
  return { success: true };
}

/** Silencia o reactiva los recordatorios de un cobro concreto. */
export async function setRemindersOff(billingItemId: string, off: boolean) {
  await requireCan("FACTURACION", "editar");

  const { count } = await prisma.billingItem.updateMany({
    where: { id: billingItemId },
    data: { remindersOff: off },
  });
  if (count === 0) return { error: "Cobro no encontrado" };

  revalidatePath(`/facturacion/${billingItemId}`);
  return { success: true };
}

/**
 * Los correos de facturación de un cliente.
 *
 * Pide CRM y no Facturación: el dato vive en la ficha del cliente y lo suele
 * saber quien lleva la cuenta, no quien persigue el cobro. Se valida el formato
 * aquí porque una dirección mal escrita no falla al guardarla, sino semanas
 * después, en un envío que nadie mira.
 */
export async function setBillingEmails(companyId: string, correos: string[]) {
  await requireCan("CRM", "editar");

  const limpios = [...new Set(correos.map((c) => c.trim().toLowerCase()).filter(Boolean))];
  if (limpios.length > 10) return { error: "Como mucho 10 correos de facturación" };

  const malo = limpios.find((c) => !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c));
  if (malo) return { error: `«${malo}» no parece un correo válido` };

  const { count } = await prisma.company.updateMany({
    where: { id: companyId },
    data: { billingEmails: limpios },
  });
  if (count === 0) return { error: "Empresa no encontrada" };

  revalidatePath(`/crm/${companyId}`);
  revalidatePath("/facturacion");
  return { success: true };
}
