"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole, isStaff } from "@/lib/auth-helpers";
import { validateFile, uploadFile } from "@/lib/s3";
import { getClientActivePlan } from "@/lib/plans.server";

const createTicketSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(200),
  description: z.string().min(1, "La descripción es requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]),
  category: z.string().optional(),
  assignedToId: z.string().optional(),
  clientId: z.string().optional(),
  planId: z.string().optional(),
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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
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

  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketStatus(ticketId: string, status: string) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) {
    return { error: "Sin permisos" };
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: status as never },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return { success: true };
}

export async function assignTicket(ticketId: string, userId: string | null) {
  await requireRole(["ADMINISTRADOR"]);

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: userId },
  });

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
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

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
