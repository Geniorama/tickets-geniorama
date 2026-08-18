/**
 * Escrituras que el agente de WhatsApp puede hacer sobre el sistema.
 *
 * No reutiliza las Server Actions de `ticket.actions.ts` / `comment.actions.ts`
 * porque aquellas arrancan con `getRequiredSession()` y terminan en
 * `redirect()`: dan por hecho que hay un navegador con cookie del otro lado, y
 * aquí solo hay un webhook. Es el mismo camino que ya tomó la integración de
 * briefs, que escribe con Prisma y dispara sus propias notificaciones.
 *
 * Lo que sí se conserva es el contrato de negocio: prefijo por empresa,
 * consecutivo dentro de la transacción, plan activo obligatorio para clientes,
 * estado POR_ASIGNAR y los mismos avisos que recibe el equipo cuando un cliente
 * abre un ticket desde la plataforma.
 */

import { prisma } from "@/lib/prisma";
import { getClientActivePlan } from "@/lib/plans.server";
import { ticketCode, ticketPrefix } from "@/lib/ticket-code";
import { notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { canAccessTicket } from "@/lib/ticket-access";
import type { Priority } from "@/generated/prisma";

const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000";

/** Marca de origen que queda en el ticket para que el equipo sepa por dónde entró. */
const SOURCE_NOTE = "_Creado desde WhatsApp._";

export type CreateResult =
  | { ok: true; ticketId: string; code: string; url: string }
  | { ok: false; error: string };

export async function createTicketFromWhatsapp(
  userId: string,
  input: { titulo: string; descripcion: string; prioridad: Priority },
): Promise<CreateResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (!user) return { ok: false, error: "Tu cuenta ya no está activa." };

  const isClient = user.role === "CLIENTE";

  // Los clientes solo pueden abrir tickets contra un plan vigente: es el mismo
  // freno que aplica la plataforma, y aquí importa más, porque por WhatsApp es
  // trivial pedir trabajo sin darse cuenta de que el plan se venció.
  let planId: string | null = null;
  if (isClient) {
    const plan = await getClientActivePlan(userId);
    if (!plan) {
      return {
        ok: false,
        error:
          "No tienes un plan activo, así que no puedo abrir el ticket. " +
          "Escríbele a tu agente para renovarlo y lo creamos enseguida.",
      };
    }
    planId = plan.id;
  }

  // El prefijo sale de la empresa dueña del plan; si no hay plan (staff), de la
  // primera empresa del usuario.
  let companyName: string | null = null;
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { company: { select: { name: true } } },
    });
    companyName = plan?.company?.name ?? null;
  }
  if (!companyName) {
    const withCompany = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { name: true }, take: 1 } },
    });
    companyName = withCompany?.companies[0]?.name ?? null;
  }
  const prefix = ticketPrefix(companyName);

  const description = `${input.descripcion.trim()}\n\n${SOURCE_NOTE}`;

  const ticket = await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.ticket.create({
      data: {
        title: input.titulo.slice(0, 200),
        description,
        priority: input.prioridad,
        status: isClient ? "POR_ASIGNAR" : "ABIERTO",
        clientId: isClient ? userId : null,
        createdById: userId,
        planId,
        prefix,
        number: (last?.number ?? 0) + 1,
        // Sin revisores explícitos, el creador queda como revisor — igual que
        // hace `resolveReviewerIds` en la acción de la plataforma.
        reviewers: { connect: [{ id: userId }] },
      },
      select: { id: true, title: true, prefix: true, number: true },
    });
  });

  const code = ticketCode(ticket.prefix, ticket.number);
  const link = `/tickets/${ticket.id}`;

  const admins = await prisma.user.findMany({
    where: { role: "ADMINISTRADOR", isActive: true },
    select: { id: true },
  });
  await notifyMany(
    admins.map((a) => a.id),
    "ticket_new",
    "Nuevo ticket por WhatsApp",
    `${user.name} abrió ${code}: "${ticket.title}"`,
    link,
  );

  return { ok: true, ticketId: ticket.id, code, url: `${APP_URL}${link}` };
}

export type CommentResult = { ok: true; code: string } | { ok: false; error: string };

export async function addCommentFromWhatsapp(
  userId: string,
  ticketId: string,
  body: string,
): Promise<CommentResult> {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (!user) return { ok: false, error: "Tu cuenta ya no está activa." };

  // El contexto ya filtró los tickets visibles, pero se revalida contra la BD:
  // el `ticketId` viene de una llamada del modelo y nunca es de fiar.
  const allowed = await canAccessTicket(ticketId, userId, user.role);
  if (!allowed) return { ok: false, error: "No encuentro ese ticket entre los tuyos." };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { title: true, prefix: true, number: true, createdById: true, assignedToId: true, clientId: true },
  });
  if (!ticket) return { ok: false, error: "No encuentro ese ticket." };

  await prisma.comment.create({
    data: {
      entityType: "TICKET",
      entityId: ticketId,
      authorId: userId,
      // Un comentario que llega por WhatsApp jamás es una nota interna: lo
      // escribe el cliente y tiene que verlo todo el hilo.
      isInternal: false,
      body: `${body.trim()}\n\n${SOURCE_NOTE}`,
    },
  });

  const recipients = [ticket.createdById, ticket.assignedToId, ticket.clientId].filter(
    (id): id is string => !!id && id !== userId,
  );
  await notifyMany(
    recipients,
    "ticket_comment",
    "Nuevo comentario por WhatsApp",
    `${user.name} comentó en: "${ticket.title}"`,
    `/tickets/${ticketId}`,
  );

  return { ok: true, code: ticketCode(ticket.prefix, ticket.number) };
}

/** Aviso al canal del equipo cuando entra un ticket nuevo por el bot. */
export async function announceWhatsappTicket(code: string, title: string, author: string, ticketId: string) {
  await sendGChatNotification(
    "ticket_new",
    "Nuevo ticket por WhatsApp",
    `${author} abrió ${code}: "${title}"`,
    `/tickets/${ticketId}`,
  );
}
