"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole, isStaff } from "@/lib/auth-helpers";
import { validateFile, uploadFile } from "@/lib/s3";
import { getClientActivePlan } from "@/lib/plans.server";
import { notify, notifyMany } from "@/lib/notify";

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

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

const ticketStatusLabels: Record<string, string> = {
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
    status: z.enum(["ABIERTO", "EN_PROGRESO", "EN_REVISION", "CERRADO"]),
    priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
    category: z.string().optional(),
    assignedToId: z.string().optional(),
    clientId: z.string().optional(),
    planId: z.string().optional(),
    siteId: z.string().optional(),
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
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: parsed.data.assignedToId, isActive: true },
      select: { id: true },
    });
    if (!assignee) return { error: "El usuario asignado no existe o está inactivo" };
  }

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
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/tickets/${ticketId}/edit`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function deleteTicket(ticketId: string) {
  await requireRole(["ADMINISTRADOR"]);

  await prisma.ticket.delete({ where: { id: ticketId } });

  revalidatePath("/tickets");
  redirect("/tickets");
}
