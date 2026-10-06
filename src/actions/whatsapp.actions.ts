"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { requireCan } from "@/lib/access/can";
import { normalizePhone } from "@/lib/crm/phone";
import { NOTIFICATION_CATEGORY_KEYS } from "@/lib/notification-categories";
import { WHATSAPP_EVENT_BY_TYPE } from "@/lib/whatsapp/config";
import { getWhatsAppSettings, sendWhatsAppTemplate, whatsappTokenConfigured } from "@/lib/whatsapp/send";

export type MyWhatsApp = {
  phone: string | null;
  enabled: boolean;
  events: string[];
  /** El administrador ya dejó el canal listo: emisor, clave y al menos una plantilla. */
  available: boolean;
};

async function channelReady() {
  const settings = await getWhatsAppSettings();
  const ready = Boolean(settings.from) && Object.keys(settings.templates).length > 0 && whatsappTokenConfigured();
  return { settings, ready };
}

export async function getMyWhatsApp(): Promise<MyWhatsApp> {
  const session = await getRequiredSession();
  const [user, { ready }] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { whatsappPhone: true, whatsappEnabled: true, whatsappEvents: true },
    }),
    channelReady(),
  ]);
  return {
    phone: user?.whatsappPhone ?? null,
    enabled: user?.whatsappEnabled ?? false,
    events: user?.whatsappEvents ?? [],
    available: ready,
  };
}

const mySchema = z.object({
  dial: z.string().regex(/^\+\d{1,4}$/, "Indicativo no válido"),
  number: z.string().max(30),
  enabled: z.boolean(),
  events: z.array(z.enum(NOTIFICATION_CATEGORY_KEYS as [string, ...string[]])),
});

/**
 * Guarda el número y el consentimiento. Activar es la autorización que pide
 * WhatsApp para escribirle a alguien: nadie queda activado por otro.
 */
export async function saveMyWhatsApp(input: z.infer<typeof mySchema>) {
  const session = await getRequiredSession();
  const parsed = mySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let phone: string | null = null;
  if (d.number.trim()) {
    const r = normalizePhone(d.number, d.dial);
    if (!r.ok) return { error: r.error };
    phone = r.e164;
  }
  if (d.enabled && !phone) return { error: "Escribe tu número de WhatsApp para activarlo." };
  if (d.enabled && d.events.length === 0) return { error: "Elige al menos un tipo de aviso." };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { whatsappPhone: phone, whatsappEnabled: d.enabled, whatsappEvents: d.events },
  });

  revalidatePath("/integraciones");
  return { success: true, phone };
}

function sampleMerge(name: string | null | undefined, detalle: string) {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    nombre: (name ?? "").trim().split(/\s+/)[0] || "hola",
    detalle,
    enlace: `${base}/integraciones`,
  };
}

/** Mensaje de prueba al propio número, con la primera plantilla configurada. */
export async function sendMyWhatsAppTest() {
  const session = await getRequiredSession();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, whatsappPhone: true },
  });
  if (!user?.whatsappPhone) return { error: "Guarda primero tu número." };

  const { settings, ready } = await channelReady();
  if (!ready) return { error: "WhatsApp todavía no está configurado en la plataforma." };

  const r = await sendWhatsAppTemplate({
    from: settings.from!,
    to: user.whatsappPhone,
    templateKey: Object.values(settings.templates)[0],
    mergeInfo: sampleMerge(user.name, "Este es un mensaje de prueba: tus avisos por WhatsApp funcionan."),
  });
  // El detalle técnico se queda en el log: a quien prueba le basta saber si salió
  if (!r.ok) {
    console.error(`[whatsapp] prueba de ${session.user.id}: ${r.error}`);
    return { error: "No se pudo enviar. Revisa el número o avisa a un administrador." };
  }
  return { success: true };
}

/**
 * Prueba de una plantilla concreta desde Administración. Devuelve la respuesta
 * de Zoho tal cual: es lo que dice si falla la clave, la plantilla o el número.
 */
export async function sendWhatsAppAdminTest(type: string, rawPhone: string) {
  const session = await requireCan("ADMIN");
  const event = WHATSAPP_EVENT_BY_TYPE.get(type);
  if (!event) return { error: "Tipo de aviso desconocido." };

  const phone = normalizePhone(rawPhone);
  if (!phone.ok) return { error: phone.error };

  const settings = await getWhatsAppSettings();
  if (!settings.from) return { error: "Guarda primero el número emisor." };
  const templateKey = settings.templates[type];
  if (!templateKey) return { error: "Guarda primero la clave de esta plantilla." };

  const r = await sendWhatsAppTemplate({
    from: settings.from,
    to: phone.e164,
    templateKey,
    mergeInfo: sampleMerge(session.user.name, `Prueba de «${event.label}» desde Geniorama.`),
  });
  return r.ok ? { success: true, messageId: r.messageId } : { error: r.error };
}
