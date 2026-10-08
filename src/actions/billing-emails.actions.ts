"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import { prisma } from "@/lib/prisma";
import { requireCan, type Capability } from "@/lib/access/can";
import { pendiente } from "@/lib/billing/status";
import { marcasDesconocidas, VARIABLES_CORREO } from "@/lib/billing/reminders/template";
import { direccionesDe } from "@/lib/billing/emails/compose";
import { COBRO_PARA_CORREO, entregar } from "@/lib/billing/emails/send";

/**
 * Las plantillas de correo y los correos que se mandan con ellas.
 *
 * Todo pide solo **entrar** a Facturación, a diferencia de las reglas de
 * recordatorio, que piden GESTOR. Una regla escribe sola a todos los clientes
 * sin que nadie vuelva a mirarla; aquí cada correo lo manda una persona, a un
 * cliente, viéndolo antes. Si un día hay que subir el listón, es esta línea.
 */
const ACCESO: Capability = "ver";

const TZ = "America/Bogota";

const plantillaSchema = z.object({
  name: z.string().min(1, "Ponle nombre a la plantilla").max(120),
  subject: z.string().min(1, "El asunto no puede ir vacío").max(200),
  body: z.string().min(1, "Escribe el mensaje").max(4000),
  onlyIfPending: z.boolean(),
});

function leer(formData: FormData) {
  return plantillaSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    subject: String(formData.get("subject") ?? "").trim(),
    body: String(formData.get("body") ?? "").trim(),
    onlyIfPending: formData.get("onlyIfPending") === "on",
  });
}

/** Una marca mal escrita llegaría al cliente tal cual: se avisa antes. */
function revisarMarcas(subject: string, body: string): string | null {
  const malas = [...new Set([
    ...marcasDesconocidas(subject, VARIABLES_CORREO),
    ...marcasDesconocidas(body, VARIABLES_CORREO),
  ])];
  if (malas.length === 0) return null;
  return `Estas marcas no existen y se enviarían tal cual: ${malas.map((m) => `{{${m}}}`).join(", ")}`;
}

export async function createEmailTemplate(formData: FormData) {
  const session = await requireCan("FACTURACION", ACCESO);

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const aviso = revisarMarcas(parsed.data.subject, parsed.data.body);
  if (aviso) return { error: aviso };

  await prisma.billingEmailTemplate.create({
    data: { ...parsed.data, createdById: session.user.id },
  });

  revalidatePath("/facturacion/correos");
  return { success: true };
}

export async function updateEmailTemplate(id: string, formData: FormData) {
  await requireCan("FACTURACION", ACCESO);

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const aviso = revisarMarcas(parsed.data.subject, parsed.data.body);
  if (aviso) return { error: aviso };

  // Lo ya programado no cambia: cada correo lleva su propio texto desde que se
  // programó, y quien lo dejó listo vio ese, no el nuevo.
  const { count } = await prisma.billingEmailTemplate.updateMany({ where: { id }, data: parsed.data });
  if (count === 0) return { error: "Plantilla no encontrada" };

  revalidatePath("/facturacion/correos");
  return { success: true };
}

export async function deleteEmailTemplate(id: string) {
  await requireCan("FACTURACION", ACCESO);

  // Los correos enviados o programados con ella sobreviven —`onDelete:
  // SetNull`— y conservan su texto y el nombre de la plantilla.
  const { count } = await prisma.billingEmailTemplate.deleteMany({ where: { id } });
  if (count === 0) return { error: "Plantilla no encontrada" };

  revalidatePath("/facturacion/correos");
  return { success: true };
}

const correoSchema = z.object({
  billingItemId: z.string().min(1),
  templateId: z.string().min(1).nullable(),
  subject: z.string().trim().min(1, "El asunto no puede ir vacío").max(200),
  body: z.string().trim().min(1, "Escribe el mensaje").max(4000),
  recipients: z.array(z.string()).min(1, "Elige al menos un destinatario").max(10),
  /** Vacío para mandarlo ya; si no, el día y la hora en Colombia. */
  cuando: z
    .object({
      fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día"),
      hora: z.number().int().min(0).max(23),
    })
    .nullable(),
});

export type CorreoInput = z.input<typeof correoSchema>;

/**
 * Manda un correo sobre un cobro, ahora o a una hora.
 *
 * El asunto y el cuerpo llegan como los dejó quien lo manda —la plantilla es
 * el punto de partida, no una camisa de fuerza— y con las marcas todavía sin
 * sustituir: eso se hace al salir.
 */
export async function sendBillingEmail(input: CorreoInput) {
  const session = await requireCan("FACTURACION", ACCESO);

  const parsed = correoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const aviso = revisarMarcas(d.subject, d.body);
  if (aviso) return { error: aviso };

  const [cobro, plantilla] = await Promise.all([
    prisma.billingItem.findUnique({ where: { id: d.billingItemId }, select: COBRO_PARA_CORREO }),
    d.templateId
      ? prisma.billingEmailTemplate.findUnique({
          where: { id: d.templateId },
          select: { id: true, name: true, onlyIfPending: true },
        })
      : null,
  ]);
  if (!cobro) return { error: "Cobro no encontrado" };
  if (d.templateId && !plantilla) return { error: "Esa plantilla ya no existe. Recarga la página" };

  // Solo a direcciones de la ficha del cliente. Ver `direccionesDe`.
  const permitidas = new Set(
    direccionesDe({
      nombre: cobro.company.name,
      billingEmails: cobro.company.billingEmails,
      contactos: cobro.company.contacts,
    }).map((x) => x.email),
  );
  const recipients = [...new Set(d.recipients.map((r) => r.trim().toLowerCase()))];
  const ajena = recipients.find((r) => !permitidas.has(r));
  if (ajena) return { error: `«${ajena}» no está en la ficha del cliente` };

  if (plantilla?.onlyIfPending && pendiente(cobro.amount, cobro.paidAmount) <= 0) {
    return { error: "Esta plantilla es de cobranza y este cobro ya no debe nada" };
  }

  let scheduledFor: Date | null = null;
  if (d.cuando) {
    scheduledFor = fromZonedTime(`${d.cuando.fecha}T${String(d.cuando.hora).padStart(2, "0")}:00:00`, TZ);
    if (Number.isNaN(scheduledFor.getTime())) return { error: "Esa fecha no es válida" };
    if (scheduledFor.getTime() <= Date.now()) {
      return { error: "Esa hora ya pasó. Elige una posterior o envíalo ahora" };
    }
    if (scheduledFor.getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      return { error: "Como mucho a un año vista" };
    }
  }

  const correo = await prisma.billingEmail.create({
    data: {
      billingItemId: cobro.id,
      templateId: plantilla?.id ?? null,
      templateName: plantilla?.name ?? null,
      subject: d.subject,
      body: d.body,
      recipients,
      onlyIfPending: plantilla?.onlyIfPending ?? false,
      // El que sale ya nace tomado: el cron solo recoge lo PROGRAMADO, así que
      // no puede cruzarse con este envío.
      status: scheduledFor ? "PROGRAMADO" : "ENVIANDO",
      scheduledFor,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  const r = scheduledFor ? null : await entregar(correo.id);

  revalidatePath(`/facturacion/${cobro.id}`);
  revalidatePath("/facturacion/correos");

  if (r && r.status !== "ENVIADO") return { error: `No salió: ${r.error ?? "motivo desconocido"}` };
  return { success: true, programado: scheduledFor !== null };
}

/** Cancela un correo que todavía espera su hora. */
export async function cancelBillingEmail(id: string) {
  await requireCan("FACTURACION", ACCESO);

  const correo = await prisma.billingEmail.findUnique({ where: { id }, select: { billingItemId: true } });
  if (!correo) return { error: "Correo no encontrado" };

  // Con la condición dentro del `update`: si el cron lo tomó un instante
  // antes, aquí no se toca nada y se dice la verdad —ya salió—.
  const { count } = await prisma.billingEmail.updateMany({
    where: { id, status: "PROGRAMADO" },
    data: { status: "CANCELADO" },
  });
  if (count === 0) return { error: "Ya no se puede cancelar: salió o ya estaba cancelado" };

  revalidatePath(`/facturacion/${correo.billingItemId}`);
  revalidatePath("/facturacion/correos");
  return { success: true };
}
