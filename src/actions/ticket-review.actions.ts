"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { afterTicketStatusChange } from "@/lib/status-change";
import { emitCommentHook, emitTicketHook } from "@/lib/hooks/dispatch";
import type { TicketStatus } from "@/generated/prisma";

const schema = z.object({
  decision: z.enum(["approve", "reopen"]),
  note: z.string().trim().max(5000).optional(),
});

/**
 * El cliente responde a un ticket que el equipo dejó En revisión.
 *
 * - Aprobar → Cerrado.
 * - Pedir cambios → Abierto, con el motivo (obligatorio) como comentario visible.
 *
 * Antes el cierre dependía de que el cliente escribiera un comentario, y el
 * equipo tenía que perseguir la confirmación a mano (o llegaba por correo y
 * quedaba fuera de la App). Ahora la decisión es un clic y queda registrada en
 * el hilo y en el historial de estados.
 *
 * Solo para clientes con acceso al ticket: el staff ya tiene el selector de estado.
 */
export async function respondToReview(
  ticketId: string,
  decision: "approve" | "reopen",
  note?: string,
) {
  const session = await getRequiredSession();
  if (isStaff(session.user.role)) {
    return { error: "El equipo cambia el estado desde el selector del ticket." };
  }

  const parsed = schema.safeParse({ decision, note });
  if (!parsed.success) return { error: "Datos no válidos." };
  const text = parsed.data.note ?? "";
  if (parsed.data.decision === "reopen" && text.length < 3) {
    return { error: "Cuéntanos qué falta o qué no quedó bien para poder revisarlo." };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      status: true,
      isDraft: true,
      clientId: true,
      createdById: true,
      assignedToId: true,
      client: { select: { name: true, email: true } },
    },
  });
  if (!ticket || ticket.isDraft) return { error: "El ticket no existe." };

  // Mismo criterio de acceso que la ficha: lo creó el usuario o su cliente es de su empresa.
  const userId = session.user.id;
  let allowed = ticket.createdById === userId;
  if (!allowed && ticket.clientId) {
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { users: { where: { role: "CLIENTE" }, select: { id: true } } } } },
    });
    const ids = new Set(me?.companies.flatMap((c) => c.users.map((u) => u.id)) ?? [userId]);
    allowed = ids.has(ticket.clientId);
  }
  if (!allowed) return { error: "No tienes acceso a este ticket." };

  // Si dos personas de la empresa responden a la vez, gana la primera.
  if (ticket.status !== "EN_REVISION") {
    return { error: "Este ticket ya no está en revisión. Recarga la página para ver su estado actual." };
  }

  const to: TicketStatus = parsed.data.decision === "approve" ? "CERRADO" : "ABIERTO";

  // Solo cambia si sigue En revisión: evita pisar un cambio simultáneo del equipo.
  const updated = await prisma.ticket.updateMany({
    where: { id: ticketId, status: "EN_REVISION" },
    data: { status: to },
  });
  if (updated.count === 0) {
    return { error: "Este ticket ya no está en revisión. Recarga la página para ver su estado actual." };
  }

  // La decisión queda en el hilo, a la vista de todos.
  const body =
    parsed.data.decision === "approve"
      ? `✅ **Aprobado por el cliente.**${text ? `\n\n${text}` : ""}`
      : `↩️ **El cliente pidió cambios y reabrió el ticket.**\n\n${text}`;
  const comment = await prisma.comment.create({
    data: { entityType: "TICKET", entityId: ticketId, authorId: userId, body, isInternal: false },
  });
  emitCommentHook(comment.id, { actor: session.user });

  await afterTicketStatusChange({
    ticketId,
    title: ticket.title,
    from: "EN_REVISION",
    to,
    actorId: userId,
    clientId: ticket.clientId,
    createdById: ticket.createdById,
    assignedToId: ticket.assignedToId,
    // Quien decide no necesita el correo de «tu ticket cambió de estado».
    client: ticket.clientId === userId ? null : ticket.client,
    autoStartTimer: false,
  });

  emitTicketHook("ticket.status_changed", ticketId, {
    actor: session.user,
    changes: { status: { from: "EN_REVISION", to } },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true as const, status: to };
}
