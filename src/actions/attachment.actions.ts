"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession, requireRole, isStaff } from "@/lib/auth-helpers";
import { addFileAttachments, deleteAttachment as removeAttachment } from "@/lib/attachments";

export async function addAttachment(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();

  // Los clientes no pueden adjuntar archivos al ticket tras su creación; solo en comentarios.
  if (!isStaff(session.user.role)) {
    return { error: "Solo el equipo puede adjuntar archivos al ticket. Los clientes pueden adjuntar en los comentarios." };
  }

  const files = (formData.getAll("files") as File[]).filter((f) => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return { error: "No se seleccionó ningún archivo" };
  }

  const { errors } = await addFileAttachments({
    entityType: "TICKET",
    entityId: ticketId,
    storageKey: ticketId,
    files,
    uploadedById: session.user.id,
  });

  revalidatePath(`/tickets/${ticketId}`);
  if (errors.length > 0) return { error: errors.join(" | ") };
  return { success: true };
}

export async function deleteAttachment(attachmentId: string, ticketId: string) {
  const session = await requireRole(["ADMINISTRADOR"]);

  const { error } = await removeAttachment(
    attachmentId,
    { entityType: "TICKET", entityId: ticketId },
    { id: session.user.id, isAdmin: true },
  );
  if (error) return { error };

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
