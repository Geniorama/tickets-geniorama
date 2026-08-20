"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { getClientActivePlan } from "@/lib/plans.server";
import { notify, notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { sendTicketAssignedEmail, sendTicketClosedEmail, sendTicketStatusChangedEmail } from "@/lib/email";
import { ticketPrefix } from "@/lib/ticket-code";
import { parseChecklistGroups } from "@/lib/checklist";
import { parseReviewerIds, resolveReviewerIds, notifyReviewers } from "@/lib/reviewers";
import { deleteCommentsFor } from "@/lib/comments";
import { addFileAttachments, deleteAttachmentsFor } from "@/lib/attachments";
import { copyChecklists, createChecklistGroups, deleteChecklistsFor } from "@/lib/checklists";
import { deleteTimeEntriesFor, stopRunningForEntity } from "@/lib/time-entries";
import { deleteVaultLinksFor } from "@/lib/vault-links";
import { emitDeletedHook, emitTicketHook } from "@/lib/hooks/dispatch";
import { ticketPayload } from "@/lib/hooks/payload";

const APP_URL = process.env.AUTH_URL ?? "http://localhost:3000";

const createTicketSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200),
  description: z.string().min(1, "La descripción es requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  category: z.string().optional(),
  assignedToId: z.string().optional(),
  clientId: z.string().optional(),
  planId: z.string().optional(),
  siteId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function createTicket(formData: FormData) {
  const session = await getRequiredSession();

  const parsed = createTicketSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
    category: formData.get("category") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
    clientId: formData.get("clientId") || undefined,
    planId: formData.get("planId") || undefined,
    siteId: formData.get("siteId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Modo borrador: solo el staff puede guardar borradores; el ticket queda
  // privado para su creador y no dispara notificaciones hasta publicarse.
  const isDraft = isStaff(session.user.role) && formData.get("isDraft") === "true";

  // Los clientes no pueden asignar tickets a ningún usuario
  if (session.user.role === "CLIENTE") {
    parsed.data.assignedToId = undefined;
  } else if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

  // Si el creador es CLIENTE, el clientId es él mismo
  const clientId =
    session.user.role === "CLIENTE"
      ? session.user.id
      : (parsed.data.clientId ?? null);

  // Determinar planId
  let planId: string | null = null;
  if (session.user.role === "CLIENTE") {
    const activePlan = await getClientActivePlan(session.user.id);
    if (!activePlan) {
      return { error: "No tienes un plan activo. Contacta a tu agente para activar un plan." };
    }
    planId = activePlan.id;
  } else {
    planId = parsed.data.planId ?? null;
  }

  // Solo staff puede definir fecha límite al crear; los clientes no
  const dueDate =
    session.user.role !== "CLIENTE" && parsed.data.dueDate
      ? new Date(parsed.data.dueDate)
      : null;

  // Resolver empresa para el prefijo: plan.company → client.companies[0] → null
  let companyName: string | null = null;
  if (planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      select: { company: { select: { name: true } } },
    });
    companyName = plan?.company?.name ?? null;
  }
  if (!companyName && clientId) {
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: { companies: { select: { name: true }, take: 1 } },
    });
    companyName = client?.companies[0]?.name ?? null;
  }
  const prefix = ticketPrefix(companyName);

  // Revisores: si no se asignan, por defecto el creador
  const reviewerIds = await resolveReviewerIds(parseReviewerIds(formData), session.user.id);

  const ticket = await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.ticket.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description,
        priority: parsed.data.priority,
        category: parsed.data.category ?? null,
        assignedToId: parsed.data.assignedToId ?? null,
        clientId,
        createdById: session.user.id,
        planId,
        siteId: parsed.data.siteId ?? null,
        dueDate,
        prefix,
        // El número (y por tanto el código) se asigna solo al publicar
        number: isDraft ? 0 : (last?.number ?? 0) + 1,
        isDraft,
        reviewers: { connect: reviewerIds.map((id) => ({ id })) },
        ...(session.user.role === "CLIENTE" ? { status: "POR_ASIGNAR" as never } : {}),
      },
    });
  });

  // Subir archivos adjuntos si los hay. Los errores por archivo se ignoran a
  // propósito: un adjunto inválido no debe impedir crear el ticket.
  await addFileAttachments({
    entityType: "TICKET",
    entityId: ticket.id,
    storageKey: ticket.id,
    files: formData.getAll("files") as File[],
    uploadedById: session.user.id,
  });

  // Crear los checklists si se enviaron
  await createChecklistGroups(
    { entityType: "TICKET", entityId: ticket.id },
    parseChecklistGroups(formData.get("checklist")),
    session.user.id,
  );

  // Resolver nombre del asignado para enriquecer notificaciones
  const assignee = ticket.assignedToId
    ? await prisma.user.findUnique({ where: { id: ticket.assignedToId }, select: { name: true } })
    : null;

  const gchatParts: string[] = [`"${ticket.title}"`];
  if (assignee?.name) gchatParts.push(`Asignado a: ${assignee.name}`);
  if (ticket.dueDate) {
    const fmt = ticket.dueDate.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
    gchatParts.push(`Límite: ${fmt}`);
  }

  // Los borradores no notifican a nadie hasta que se publican
  if (!isDraft) {
    // Notificar al asignado si no es el creador
    if (ticket.assignedToId && ticket.assignedToId !== session.user.id) {
      await notify(
        ticket.assignedToId,
        "ticket_assigned",
        "Ticket asignado",
        `Se te asignó: "${ticket.title}"`,
        `/tickets/${ticket.id}`,
        true // asignación individual: no va al webhook de equipo (GChat)
      );
    }

    if (session.user.role === "CLIENTE") {
      // Cliente crea ticket → notificar a admins en-app + GChat
      const admins = await prisma.user.findMany({
        where: { role: "ADMINISTRADOR", isActive: true },
        select: { id: true },
      });
      await notifyMany(
        admins.map((a) => a.id),
        "ticket_new",
        "Nuevo ticket",
        `${session.user.name} abrió: ${gchatParts.join(" · ")}`,
        `/tickets/${ticket.id}`
      );
    } else {
      // Staff crea ticket → solo GChat (no in-app)
      await sendGChatNotification(
        "ticket_new",
        "Nuevo ticket",
        `${session.user.name} creó: ${gchatParts.join(" · ")}`,
        `/tickets/${ticket.id}`
      );
    }
  }

  // Los hooks son el canal externo: se avisa de lo que existe de verdad, así
  // que un borrador no sale de aquí hasta que alguien lo publica.
  if (!isDraft) {
    emitTicketHook("ticket.created", ticket.id, { actor: session.user });
  }

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

/**
 * Publica un ticket que estaba en modo borrador: lo vuelve visible para todos
 * y dispara las notificaciones de "nuevo ticket" (igual que al crearlo).
 */
export async function publishTicket(ticketId: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      isDraft: true,
      createdById: true,
      assignedToId: true,
      dueDate: true,
      prefix: true,
      assignedTo: { select: { name: true } },
    },
  });
  if (!ticket) return { error: "Ticket no encontrado" };
  // Solo el creador del borrador puede publicarlo (los borradores son privados)
  if (ticket.createdById !== session.user.id) return { error: "Sin permisos" };
  if (!ticket.isDraft) return { error: "El ticket ya está publicado" };

  // Asignar el número/código consecutivo recién al publicar
  await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix: ticket.prefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    await tx.ticket.update({
      where: { id: ticketId },
      data: { isDraft: false, number: (last?.number ?? 0) + 1 },
    });
  });

  const gchatParts: string[] = [`"${ticket.title}"`];
  if (ticket.assignedTo?.name) gchatParts.push(`Asignado a: ${ticket.assignedTo.name}`);
  if (ticket.dueDate) {
    const fmt = ticket.dueDate.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
    gchatParts.push(`Límite: ${fmt}`);
  }

  if (ticket.assignedToId && ticket.assignedToId !== session.user.id) {
    await notify(
      ticket.assignedToId,
      "ticket_assigned",
      "Ticket asignado",
      `Se te asignó: "${ticket.title}"`,
      `/tickets/${ticketId}`,
      true // asignación individual: no va al webhook de equipo (GChat)
    );
  }

  await sendGChatNotification(
    "ticket_new",
    "Nuevo ticket",
    `${session.user.name} creó: ${gchatParts.join(" · ")}`,
    `/tickets/${ticketId}`
  );

  emitTicketHook("ticket.created", ticketId, { actor: session.user });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

const ticketStatusLabels: Record<string, string> = {
  POR_ASIGNAR: "Por asignar",
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  CERRADO: "Cerrado",
};

export async function updateTicketStatus(ticketId: string, status: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) {
    return { error: "Sin permisos" };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      status: true,
      clientId: true,
      createdById: true,
      assignedToId: true,
      client: { select: { name: true, email: true } },
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: status as never },
  });

  // Detener timers activos al pasar a revisión o cerrar el ticket
  if (["EN_REVISION", "CERRADO"].includes(status)) {
    await stopRunningForEntity({ entityType: "TICKET", entityId: ticketId });
  }

  if (ticket) {
    const label = ticketStatusLabels[status] ?? status;
    const recipients = [ticket.clientId, ticket.createdById, ticket.assignedToId]
      .filter((id): id is string => !!id && id !== session.user.id);
    await notifyMany(
      recipients,
      "ticket_status",
      "Ticket actualizado",
      `"${ticket.title}" cambió a: ${label}`,
      `/tickets/${ticketId}`
    );

    // Avisar a los revisores cuando el ticket entra en revisión
    if (status === "EN_REVISION" && ticket.status !== "EN_REVISION") {
      await notifyReviewers("ticket", ticketId, ticket.title, `/tickets/${ticketId}`, session.user.id, true);
    }

    // Email al cliente en cada cambio de estado (CERRADO usa su propia plantilla)
    if (status !== ticket.status && ticket.client) {
      const url = `${APP_URL}/tickets/${ticketId}`;
      if (status === "CERRADO") {
        void sendTicketClosedEmail(ticket.client, ticket.title, url).catch(console.error);
      } else {
        void sendTicketStatusChangedEmail(ticket.client, ticket.title, label, url).catch(console.error);
      }
    }

    // Webhook: notificar cuando el ticket vuelve a Abierto (pendiente)
    if (status === "ABIERTO" && ticket.status !== "ABIERTO") {
      await sendGChatNotification(
        "ticket_status",
        "Ticket reabierto",
        `"${ticket.title}" volvió a *Abierto*`,
        `/tickets/${ticketId}`
      );
    }
  }

  if (ticket && ticket.status !== status) {
    emitTicketHook("ticket.status_changed", ticketId, {
      actor: session.user,
      changes: { status: { from: ticket.status, to: status } },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function assignTicket(ticketId: string, userId: string | null) {
  const session = await requireCan("TICKETS", "gestionar");

  if (userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { title: true, assignedToId: true, client: { select: { name: true, email: true } } },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: userId },
  });

  if (userId && ticket) {
    await notify(
      userId,
      "ticket_assigned",
      "Ticket asignado",
      `Se te asignó: "${ticket.title}"`,
      `/tickets/${ticketId}`,
      true // asignación individual: no va al webhook de equipo (GChat)
    );

    if (ticket.client) {
      const url = `${APP_URL}/tickets/${ticketId}`;
      void sendTicketAssignedEmail(ticket.client, ticket.title, url).catch(console.error);
    }
  }

  if ((ticket?.assignedToId ?? null) !== userId) {
    emitTicketHook("ticket.assigned", ticketId, {
      actor: session.user,
      changes: { assignedToId: { from: ticket?.assignedToId ?? null, to: userId } },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function updateTicket(ticketId: string, formData: FormData) {
  const session = await requireCan("TICKETS", "gestionar");

  const schema = z.object({
    title: z.string().min(1, "El título es requerido").max(200),
    description: z.string().min(1, "La descripción es requerida"),
    status: z.enum(["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"]),
    priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
    category: z.string().optional(),
    assignedToId: z.string().optional(),
    clientId: z.string().optional(),
    planId: z.string().optional(),
    siteId: z.string().optional(),
    dueDate: z.string().optional(),
  });

  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    category: formData.get("category") || undefined,
    assignedToId: formData.get("assignedToId") || undefined,
    clientId: formData.get("clientId") || undefined,
    planId: formData.get("planId") || undefined,
    siteId: formData.get("siteId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

  const oldTicket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      dueDate: true,
      assignedToId: true,
      clientId: true,
      createdById: true,
      status: true,
      client: { select: { name: true, email: true } },
    },
  });

  const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

  // Revisores: si quedan vacíos, por defecto el creador del ticket
  const reviewerIds = await resolveReviewerIds(
    parseReviewerIds(formData),
    oldTicket?.createdById ?? session.user.id
  );

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status as never,
      priority: parsed.data.priority as never,
      category: parsed.data.category ?? null,
      assignedToId: parsed.data.assignedToId ?? null,
      clientId: parsed.data.clientId ?? null,
      planId: parsed.data.planId ?? null,
      siteId: parsed.data.siteId ?? null,
      dueDate: newDueDate,
      reviewers: { set: reviewerIds.map((id) => ({ id })) },
    },
  });

  // Avisar a los revisores cuando el ticket entra en revisión
  if (parsed.data.status === "EN_REVISION" && oldTicket?.status !== "EN_REVISION") {
    await notifyReviewers("ticket", ticketId, parsed.data.title, `/tickets/${ticketId}`, session.user.id, true);
  }

  // Notificar cambio de fecha límite
  if (newDueDate?.toDateString() !== oldTicket?.dueDate?.toDateString()) {
    const fmt = (d: Date | null) =>
      d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "Sin fecha";
    const recipients = [oldTicket?.createdById, oldTicket?.assignedToId, oldTicket?.clientId]
      .filter((id): id is string => Boolean(id));
    await notifyMany(
      recipients,
      "ticket_date_changed",
      "Fecha límite actualizada",
      `"${parsed.data.title}" — Límite: ${fmt(newDueDate)}`,
      `/tickets/${ticketId}`
    );
  }

  // Email al cliente en cada cambio de estado (CERRADO usa su propia plantilla)
  if (parsed.data.status !== oldTicket?.status && oldTicket?.client) {
    const url = `${APP_URL}/tickets/${ticketId}`;
    if (parsed.data.status === "CERRADO") {
      void sendTicketClosedEmail(oldTicket.client, parsed.data.title, url).catch(console.error);
    } else {
      const label = ticketStatusLabels[parsed.data.status] ?? parsed.data.status;
      void sendTicketStatusChangedEmail(oldTicket.client, parsed.data.title, label, url).catch(console.error);
    }
  }

  if (parsed.data.status !== oldTicket?.status) {
    emitTicketHook("ticket.status_changed", ticketId, {
      actor: session.user,
      changes: { status: { from: oldTicket?.status ?? null, to: parsed.data.status } },
    });
  }
  if ((parsed.data.assignedToId ?? null) !== (oldTicket?.assignedToId ?? null)) {
    emitTicketHook("ticket.assigned", ticketId, {
      actor: session.user,
      changes: {
        assignedToId: { from: oldTicket?.assignedToId ?? null, to: parsed.data.assignedToId ?? null },
      },
    });
  }
  emitTicketHook("ticket.updated", ticketId, { actor: session.user });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}/edit`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function configureTicket(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();
  if (!isAdmin(session.user.role as never)) return { error: "Sin permisos" };

  const assignedToId = (formData.get("assignedToId") as string) || null;
  const dueDateStr = (formData.get("dueDate") as string) || null;
  const priority = formData.get("priority") as string;
  const status = (formData.get("status") as string) || "ABIERTO";

  const validPriorities = ["BAJA", "MEDIA", "ALTA", "CRITICA"];
  const validStatuses = ["POR_ASIGNAR", "ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"];
  if (!validPriorities.includes(priority)) return { error: "Prioridad inválida" };
  if (!validStatuses.includes(status)) return { error: "Estado inválido" };

  if (assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      assignedToId: true,
      dueDate: true,
      clientId: true,
      createdById: true,
      status: true,
      client: { select: { name: true, email: true } },
    },
  });

  const newDueDate = dueDateStr ? new Date(dueDateStr) : null;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      dueDate: newDueDate,
      assignedToId,
      priority: priority as never,
      status: status as never,
    },
  });

  const ticketUrl = `${APP_URL}/tickets/${ticketId}`;

  let assignedEmailSent = false;
  if (assignedToId && assignedToId !== ticket?.assignedToId && assignedToId !== session.user.id) {
    await notify(assignedToId, "ticket_assigned", "Ticket asignado", `Se te asignó: "${ticket?.title}"`, `/tickets/${ticketId}`, true);

    if (ticket?.client) {
      void sendTicketAssignedEmail(ticket.client, ticket.title, ticketUrl).catch(console.error);
      assignedEmailSent = true;
    }
  }

  if (status === "EN_REVISION" && ticket?.status !== "EN_REVISION") {
    await notifyReviewers("ticket", ticketId, ticket?.title ?? "", `/tickets/${ticketId}`, session.user.id, true);
  }

  // Email al cliente en cada cambio de estado (CERRADO usa su propia plantilla;
  // si ya se envió el correo de asignación en esta misma acción, no duplicamos)
  if (status !== ticket?.status && ticket?.client) {
    if (status === "CERRADO") {
      void sendTicketClosedEmail(ticket.client, ticket.title, ticketUrl).catch(console.error);
    } else if (!assignedEmailSent) {
      const label = ticketStatusLabels[status] ?? status;
      void sendTicketStatusChangedEmail(ticket.client, ticket.title, label, ticketUrl).catch(console.error);
    }
  }

  // Notificar cambio de fecha límite
  if (newDueDate?.toDateString() !== ticket?.dueDate?.toDateString()) {
    const fmt = (d: Date | null) =>
      d ? d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "Sin fecha";
    const recipients = [ticket?.createdById, assignedToId ?? ticket?.assignedToId, ticket?.clientId]
      .filter((id): id is string => Boolean(id));
    await notifyMany(
      recipients,
      "ticket_date_changed",
      "Fecha límite actualizada",
      `"${ticket?.title}" — Límite: ${fmt(newDueDate)}`,
      `/tickets/${ticketId}`
    );
  }

  if (status !== ticket?.status) {
    emitTicketHook("ticket.status_changed", ticketId, {
      actor: session.user,
      changes: { status: { from: ticket?.status ?? null, to: status } },
    });
  }
  if (assignedToId !== (ticket?.assignedToId ?? null)) {
    emitTicketHook("ticket.assigned", ticketId, {
      actor: session.user,
      changes: { assignedToId: { from: ticket?.assignedToId ?? null, to: assignedToId } },
    });
  }
  emitTicketHook("ticket.updated", ticketId, { actor: session.user });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function deleteTicket(ticketId: string) {
  const session = await requireCan("TICKETS", "gestionar");

  // El retrato se toma antes de borrar: después no hay ticket que consultar y
  // el hook llegaría con un id y nada más.
  const snapshot = await ticketPayload(ticketId);

  // Comentarios y adjuntos son polimórficos: no hay clave foránea que los borre
  // en cascada, así que se eliminan explícitamente junto con el ticket.
  await prisma.$transaction(async (tx) => {
    await deleteCommentsFor("TICKET", ticketId, tx);
    await deleteAttachmentsFor("TICKET", ticketId, tx);
    await deleteChecklistsFor("TICKET", ticketId, tx);
    await deleteTimeEntriesFor("TICKET", ticketId, tx);
    await deleteVaultLinksFor("TICKET", ticketId, tx);
    await tx.ticket.delete({ where: { id: ticketId } });
  });

  if (snapshot) emitDeletedHook("ticket.deleted", snapshot, { actor: session.user });

  revalidatePath("/tickets");
  redirect("/tickets");
}

export async function duplicateTicket(ticketId: string, includeChecklists = false) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const original = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      description: true,
      priority: true,
      category: true,
      assignedToId: true,
      clientId: true,
      planId: true,
      siteId: true,
      prefix: true,
    },
  });
  if (!original) return { error: "Ticket no encontrado" };

  const copyPrefix = original.prefix ?? ticketPrefix(null);

  const copy = await prisma.$transaction(async (tx) => {
    const last = await tx.ticket.findFirst({
      where: { prefix: copyPrefix },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const created = await tx.ticket.create({
      data: {
        title: `Copia de ${original.title}`,
        description: original.description,
        priority: original.priority,
        category: original.category,
        assignedToId: original.assignedToId,
        clientId: original.clientId,
        createdById: session.user.id,
        planId: original.planId,
        siteId: original.siteId,
        status: "POR_ASIGNAR",
        prefix: copyPrefix,
        number: (last?.number ?? 0) + 1,
      },
    });

    if (includeChecklists) {
      await copyChecklists(
        { entityType: "TICKET", entityId: ticketId },
        { entityType: "TICKET", entityId: created.id },
        session.user.id,
        tx,
      );
    }

    return created;
  });

  emitTicketHook("ticket.created", copy.id, { actor: session.user });

  revalidatePath("/tickets");
  redirect(`/tickets/${copy.id}`);
}
