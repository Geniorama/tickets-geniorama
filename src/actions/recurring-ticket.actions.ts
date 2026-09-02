"use server";

/**
 * Tickets recurrentes: alta, edición y disparo manual.
 *
 * Espejo de `recurring-task.actions.ts`, con los campos de un ticket. La lógica
 * de cadencia se comparte (`lib/recurrence.ts`) y la de generación también
 * (`lib/recurring-tickets.ts`): aquí solo quedan el guardia, la validación de
 * lo que llega del navegador y el refresco de pantallas.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import type { RecurrenceFrequency } from "@/generated/prisma";
import { serializeDaysOfWeek } from "@/lib/recurrence";
import { parseChecklistGroups } from "@/lib/checklist";
import { generarTicketRecurrente, avisarTicketRecurrente } from "@/lib/recurring-tickets";
import { recordActivity, recordUpdate } from "@/lib/activity/record";

const LISTA = "/admin/tickets-recurrentes";

const schema = z.object({
  title: z.string().min(1, "Título requerido").max(200),
  description: z.string().min(1, "Descripción requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  category: z.string().optional(),
  checklist: z
    .array(z.object({ title: z.string().min(1).max(120), items: z.array(z.string().min(1).max(500)) }))
    .max(20)
    .optional(),
  clientId: z.string().optional(),
  planId: z.string().optional(),
  siteId: z.string().optional(),
  assignedToId: z.string().optional(),
  reviewerIds: z.array(z.string()).max(20).optional(),
  frequency: z.enum(["DIARIA", "SEMANAL", "MENSUAL"]),
  interval: z.number().int().min(1).max(365),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(-1).max(31).optional(),
  startDate: z.string().min(1, "Fecha de inicio requerida"),
  endDate: z.string().optional(),
  dueDateOffsetDays: z.number().int().min(0).max(365),
  isActive: z.boolean().optional(),
});

type Input = z.infer<typeof schema>;

function opcional(formData: FormData, key: string): string | undefined {
  const raw = formData.get(key);
  return raw ? String(raw).trim() || undefined : undefined;
}

function parseFormData(formData: FormData): Input {
  const dias = formData
    .getAll("daysOfWeek")
    .map((v) => parseInt(String(v), 10))
    .filter((n) => !Number.isNaN(n));
  const dayOfMonthRaw = formData.get("dayOfMonth");

  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    priority: String(formData.get("priority") ?? "MEDIA") as Input["priority"],
    category: opcional(formData, "category"),
    checklist: parseChecklistGroups(formData.get("checklist")),
    clientId: opcional(formData, "clientId"),
    planId: opcional(formData, "planId"),
    siteId: opcional(formData, "siteId"),
    assignedToId: opcional(formData, "assignedToId"),
    reviewerIds: formData.getAll("reviewerIds").map(String).filter(Boolean),
    frequency: String(formData.get("frequency") ?? "MENSUAL") as RecurrenceFrequency,
    interval: parseInt(String(formData.get("interval") ?? "1"), 10),
    daysOfWeek: dias,
    dayOfMonth: dayOfMonthRaw ? parseInt(String(dayOfMonthRaw), 10) : undefined,
    startDate: String(formData.get("startDate") ?? ""),
    endDate: opcional(formData, "endDate"),
    dueDateOffsetDays: parseInt(String(formData.get("dueDateOffsetDays") ?? "0"), 10),
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
  };
}

/**
 * Medianoche UTC explícita: así `formatDate` (que lee partes UTC) muestra
 * siempre el día del calendario tecleado, sin depender de la TZ del servidor.
 * Mismo criterio que las tareas recurrentes.
 */
function toDateLocal(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

/** Lo que se guarda, ya normalizado. Idéntico al crear y al editar. */
function columnas(data: Input) {
  return {
    title: data.title,
    description: data.description,
    priority: data.priority,
    category: data.category || null,
    checklist: data.checklist ?? [],
    clientId: data.clientId || null,
    planId: data.planId || null,
    siteId: data.siteId || null,
    assignedToId: data.assignedToId || null,
    reviewerIds: data.reviewerIds ?? [],
    frequency: data.frequency,
    interval: data.interval,
    daysOfWeek:
      data.daysOfWeek && data.daysOfWeek.length > 0 ? serializeDaysOfWeek(data.daysOfWeek) : null,
    // El día del mes solo significa algo en una mensual; guardarlo en una
    // semanal dejaría un dato que nadie lee y que confunde al editar.
    dayOfMonth: data.frequency === "MENSUAL" ? (data.dayOfMonth ?? null) : null,
    dueDateOffsetDays: data.dueDateOffsetDays,
  };
}

export async function createRecurringTicket(formData: FormData) {
  const session = await requireCan("TICKETS", "gestionar");

  const parsed = schema.safeParse(parseFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const data = parsed.data;

  const startDate = toDateLocal(data.startDate);

  const created = await prisma.recurringTicketTemplate.create({
    data: {
      ...columnas(data),
      createdById: session.user.id,
      startDate,
      endDate: data.endDate ? toDateLocal(data.endDate) : null,
      // La primera vez corre el día de inicio, no una cadencia después.
      nextRunAt: startDate,
      isActive: data.isActive ?? true,
    },
    select: { id: true },
  });

  recordActivity({
    entityType: "TICKET",
    entityId: created.id,
    action: "ticket.recurrence_created",
    label: data.title,
    meta: { href: `${LISTA}/${created.id}/edit` },
    actor: session.user,
  });

  revalidatePath(LISTA);
  redirect(`${LISTA}/${created.id}/edit?created=1`);
}

export async function updateRecurringTicket(id: string, formData: FormData) {
  const session = await requireCan("TICKETS", "gestionar");

  const parsed = schema.safeParse(parseFormData(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const data = parsed.data;

  const existing = await prisma.recurringTicketTemplate.findUnique({ where: { id } });
  if (!existing) return { error: "Recurrencia no encontrada" };

  const startDate = toDateLocal(data.startDate);
  const cols = columnas(data);

  // Tocar el patrón reprograma desde la fecha de inicio. Sin esto, cambiar de
  // «cada mes» a «cada semana» no se notaría hasta el mes siguiente, que es
  // justo cuando alguien viene a preguntar por qué no cambió nada.
  const patronCambio =
    existing.frequency !== cols.frequency ||
    existing.interval !== cols.interval ||
    existing.daysOfWeek !== cols.daysOfWeek ||
    (existing.dayOfMonth ?? null) !== cols.dayOfMonth ||
    existing.startDate.getTime() !== startDate.getTime();

  await prisma.recurringTicketTemplate.update({
    where: { id },
    data: {
      ...cols,
      startDate,
      endDate: data.endDate ? toDateLocal(data.endDate) : null,
      ...(patronCambio ? { nextRunAt: startDate } : {}),
      isActive: data.isActive ?? existing.isActive,
    },
  });

  recordUpdate({
    entityType: "TICKET",
    entityId: id,
    action: "ticket.recurrence_updated",
    label: data.title,
    before: existing,
    after: { title: data.title, priority: data.priority, assignedToId: cols.assignedToId },
    extraFields: ["title", "priority", "assignedToId"],
    meta: { href: `${LISTA}/${id}/edit` },
    actor: session.user,
  });

  revalidatePath(LISTA);
  revalidatePath(`${LISTA}/${id}/edit`);
  return { ok: true };
}

export async function toggleRecurringTicketActive(id: string) {
  const session = await requireCan("TICKETS", "gestionar");

  const existing = await prisma.recurringTicketTemplate.findUnique({
    where: { id },
    select: { isActive: true, title: true },
  });
  if (!existing) return { error: "Recurrencia no encontrada" };

  await prisma.recurringTicketTemplate.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  recordActivity({
    entityType: "TICKET",
    entityId: id,
    action: existing.isActive ? "ticket.recurrence_paused" : "ticket.recurrence_resumed",
    label: existing.title,
    meta: { href: `${LISTA}/${id}/edit` },
    actor: session.user,
  });

  revalidatePath(LISTA);
  return { ok: true };
}

export async function deleteRecurringTicket(id: string) {
  const session = await requireCan("TICKETS", "gestionar");

  const existing = await prisma.recurringTicketTemplate.findUnique({
    where: { id },
    select: { title: true },
  });

  // Los tickets ya generados no se van con ella: `recurringTemplateId` queda en
  // null y siguen ahí, con su historial y sus horas.
  await prisma.recurringTicketTemplate.delete({ where: { id } });

  recordActivity({
    entityType: "TICKET",
    entityId: id,
    action: "ticket.recurrence_deleted",
    label: existing?.title ?? null,
    actor: session.user,
  });

  revalidatePath(LISTA);
  redirect(LISTA);
}

/**
 * Abre ya el ticket de esta recurrencia, sin esperar al barrido.
 *
 * Se usa para probar una programación recién escrita y para adelantar el
 * mantenimiento de un mes concreto.
 */
export async function runRecurringTicketNow(id: string) {
  const session = await requireCan("TICKETS", "gestionar");

  const tpl = await prisma.recurringTicketTemplate.findUnique({
    where: { id },
    include: { assignedTo: { select: { name: true } } },
  });
  if (!tpl) return { error: "Recurrencia no encontrada" };
  if (!tpl.isActive) return { error: "La recurrencia está pausada" };

  const ticket = await generarTicketRecurrente(tpl, session.user.id);
  await avisarTicketRecurrente(tpl, ticket, session.user.name ?? "Alguien del equipo");

  revalidatePath(LISTA);
  revalidatePath("/tickets");
  return { ok: true, ticketId: ticket.id };
}

/**
 * Los datos de un ticket existente, listos para precargar el formulario.
 *
 * Existe para el botón «Hacer recurrente» de la ficha: convertir a mano algo
 * que ya se repite significaba volver a teclear título, descripción, cliente,
 * plan y sitio, y ahí es donde se cuela el error que hace que el ticket
 * mensual salga sin plan y no descuente horas.
 */
export async function ticketComoRecurrencia(ticketId: string) {
  await requireCan("TICKETS", "gestionar");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      description: true,
      priority: true,
      category: true,
      clientId: true,
      planId: true,
      siteId: true,
      assignedToId: true,
      reviewers: { select: { id: true } },
    },
  });
  if (!ticket) return { error: "Ticket no encontrado" as const };

  return {
    datos: {
      ...ticket,
      reviewerIds: ticket.reviewers.map((r) => r.id),
    },
  };
}
