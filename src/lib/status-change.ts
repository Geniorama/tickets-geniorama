/**
 * Lo que pasa alrededor de un cambio de estado de una tarea o un ticket.
 *
 * Vivía dentro de las Server Actions del tablero, y la API —por donde entra el
 * asistente (MCP)— tenía una copia recortada: movía el estado pero no avisaba
 * a Google Chat, ni a los revisores, ni al cliente por correo, ni paraba los
 * cronómetros. Está aquí para que cambiar un estado sea el mismo hecho se haga
 * desde donde se haga.
 *
 * Aquí solo van los avisos y los cronómetros. Guardar el estado y emitir los
 * hooks (`task.status_changed`…) lo sigue haciendo quien llama.
 */

import type { TaskStatus, TicketStatus } from "@/generated/prisma";
import { notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { notifyReviewers } from "@/lib/reviewers";
import { sendTicketClosedEmail, sendTicketStatusChangedEmail } from "@/lib/email";
import { startTimer, stopRunningForEntity } from "@/lib/time-entries";
import { STATUS_LABELS } from "@/lib/status-labels";

// ─── Tareas ──────────────────────────────────────────────────────────────────

/** Cómo se cuenta en Google Chat cada estado al que se llega. */
const TASK_GCHAT: Partial<Record<TaskStatus, { title: string; verb: string }>> = {
  EN_PROGRESO: { title: "Tarea en progreso", verb: "pasó a *En progreso*" },
  EN_REVISION: { title: "Tarea en revisión", verb: "pasó a *En revisión*" },
  PENDIENTE:   { title: "Tarea pendiente",   verb: "volvió a *Pendiente*" },
};

export async function afterTaskStatusChange(input: {
  taskId: string;
  title: string;
  from: TaskStatus;
  to: TaskStatus;
  actorId: string;
  taskUrl: string;
  projectIsPrivate: boolean;
  createdById: string | null;
  assignedToId: string | null;
  /**
   * Arrancar el cronómetro al pasar a En progreso. Lo hace el tablero, donde
   * quien mueve la tarjeta es quien se pone a trabajar. No la API: un asistente
   * que cambia un estado no debe dejar un reloj corriendo a nombre de nadie.
   */
  autoStartTimer: boolean;
}): Promise<void> {
  const { taskId, title, from, to, actorId, taskUrl, projectIsPrivate } = input;
  if (from === to) return;

  if (to === "EN_PROGRESO" && input.autoStartTimer) {
    await startTimer({ entityType: "TASK", entityId: taskId }, actorId);
  }
  // Al pasar a revisión o completar ya nadie está trabajando en ella
  if (to === "EN_REVISION" || to === "COMPLETADO") {
    await stopRunningForEntity({ entityType: "TASK", entityId: taskId });
  }

  const gchat = TASK_GCHAT[to];
  if (gchat && !projectIsPrivate) {
    await sendGChatNotification("task_status", gchat.title, `"${title}" ${gchat.verb}`, taskUrl);
  }

  if (to === "EN_REVISION") {
    await notifyReviewers("task", taskId, title, taskUrl, actorId, true);
  }

  if (to === "COMPLETADO") {
    const recipients = [input.createdById, input.assignedToId].filter(
      (id): id is string => !!id && id !== actorId,
    );
    // `notifyMany` avisa a Google Chat aunque no quede nadie a quien notificar:
    // que una tarea se completó le interesa al canal aunque la cierre su dueño.
    await notifyMany(
      recipients,
      "task_completed",
      "Tarea completada",
      `"${title}" marcada como completada`,
      taskUrl,
      projectIsPrivate,
    );
  }
}

// ─── Tickets ─────────────────────────────────────────────────────────────────

export async function afterTicketStatusChange(input: {
  ticketId: string;
  title: string;
  from: TicketStatus;
  to: TicketStatus;
  actorId: string;
  clientId: string | null;
  createdById: string | null;
  assignedToId: string | null;
  /** El cliente del ticket, para el correo. */
  client: { name: string; email: string } | null;
}): Promise<void> {
  const { ticketId, title, from, to, actorId } = input;
  if (from === to) return;

  const link = `/tickets/${ticketId}`;
  const label = STATUS_LABELS[to] ?? to;

  if (to === "EN_REVISION" || to === "CERRADO") {
    await stopRunningForEntity({ entityType: "TICKET", entityId: ticketId });
  }

  const recipients = [input.clientId, input.createdById, input.assignedToId].filter(
    (id): id is string => !!id && id !== actorId,
  );
  await notifyMany(recipients, "ticket_status", "Ticket actualizado", `"${title}" cambió a: ${label}`, link);

  if (to === "EN_REVISION") {
    await notifyReviewers("ticket", ticketId, title, link, actorId, true);
  }

  // Correo al cliente en cada cambio (cerrar tiene su propia plantilla)
  if (input.client) {
    const url = `${(process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}${link}`;
    if (to === "CERRADO") {
      void sendTicketClosedEmail(input.client, title, url).catch(console.error);
    } else {
      void sendTicketStatusChangedEmail(input.client, title, label, url).catch(console.error);
    }
  }

  if (to === "ABIERTO") {
    await sendGChatNotification("ticket_status", "Ticket reabierto", `"${title}" volvió a *Abierto*`, link);
  }
}
