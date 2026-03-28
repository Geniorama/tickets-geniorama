"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { validateFile, uploadFile } from "@/lib/s3";
import { getClientActivePlan } from "@/lib/plans.server";
import { notify, notifyMany } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";

const createTicketSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200),
  description: z.string().min(1, "La descripción es requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  category: z.string().optional(),
  assignedToId: z.string().optional(),
  clientId: z.string().optional(),
  planId: z.string().optional(),
  siteId: z.string().optional(),
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

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

  const ticket = await prisma.ticket.create({
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
      ...(session.user.role === "CLIENTE" ? { status: "POR_ASIGNAR" as never } : {}),
    },
  });

  // Subir archivos adjuntos si los hay
  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f instanceof File && f.size > 0);

  for (const file of validFiles) {
    const err = validateFile(file);
    if (err) continue; // saltar archivos inválidos silenciosamente
    try {
      const { storagePath, fileUrl } = await uploadFile(file, ticket.id);
      await prisma.ticketAttachment.create({
        data: {
          ticketId: ticket.id,
          uploadedById: session.user.id,
          fileName: file.name,
          fileUrl,
          storagePath,
        },
      });
    } catch {
      // continuar aunque falle un archivo
    }
  }

  // Crear ítems de checklist si se enviaron
  const checklistRaw = formData.get("checklist") as string | null;
  if (checklistRaw) {
    try {
      const items = JSON.parse(checklistRaw) as string[];
      for (let i = 0; i < items.length; i++) {
        const title = items[i]?.trim();
        if (!title) continue;
        await prisma.ticketChecklistItem.create({
          data: { ticketId: ticket.id, title, position: i, createdById: session.user.id },
        });
      }
    } catch { /* JSON inválido, ignorar */ }
  }

  // Resolver nombre del asignado para enriquecer notificaciones
  const assignee = ticket.assignedToId
    ? await prisma.user.findUnique({ where: { id: ticket.assignedToId }, select: { name: true } })
    : null;

  const gchatParts: string[] = [`"${ticket.title}"`];
  if (assignee?.name) gchatParts.push(`Asignado a: ${assignee.name}`);
  // dueDate no está disponible al crear un ticket, se omite

  // Notificar al asignado si no es el creador
  if (ticket.assignedToId && ticket.assignedToId !== session.user.id) {
    await notify(
      ticket.assignedToId,
      "ticket_assigned",
      "Ticket asignado",
      `Se te asignó: "${ticket.title}"`,
      `/tickets/${ticket.id}`
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

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
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
    select: { title: true, clientId: true, createdById: true, assignedToId: true },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: status as never },
  });

  // Detener timers activos al pasar a revisión o cerrar el ticket
  if (["EN_REVISION", "CERRADO"].includes(status)) {
    await prisma.timeEntry.updateMany({
      where: { ticketId, stoppedAt: null },
      data: { stoppedAt: new Date() },
    });
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
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function assignTicket(ticketId: string, userId: string | null) {
  await requireRole(["ADMINISTRADOR"]);

  if (userId) {
    const assignee = await prisma.user.findUnique({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { title: true },
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
      `/tickets/${ticketId}`
    );
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function updateTicket(ticketId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

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
    select: { title: true, dueDate: true, assignedToId: true, clientId: true, createdById: true },
  });

  const newDueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;

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
    },
  });

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
    select: { title: true, assignedToId: true, dueDate: true, clientId: true, createdById: true },
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

  if (assignedToId && assignedToId !== ticket?.assignedToId && assignedToId !== session.user.id) {
    await notify(assignedToId, "ticket_assigned", "Ticket asignado", `Se te asignó: "${ticket?.title}"`, `/tickets/${ticketId}`);
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

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function deleteTicket(ticketId: string) {
  await requireRole(["ADMINISTRADOR"]);

  await prisma.ticket.delete({ where: { id: ticketId } });

  revalidatePath("/tickets");
  redirect("/tickets");
}

export async function duplicateTicket(ticketId: string) {
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
    },
  });
  if (!original) return { error: "Ticket no encontrado" };

  const copy = await prisma.ticket.create({
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
    },
  });

  revalidatePath("/tickets");
  redirect(`/tickets/${copy.id}`);
}
