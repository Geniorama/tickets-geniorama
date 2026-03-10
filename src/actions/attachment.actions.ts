"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole } from "@/lib/auth-helpers";
import { validateFile, uploadFile, deleteFile } from "@/lib/s3";

export async function addAttachment(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No se seleccionó ningún archivo" };
  }

  const validationError = validateFile(file);
  if (validationError) return { error: validationError };

  try {
    const { storagePath, fileUrl } = await uploadFile(file, ticketId);

    await prisma.ticketAttachment.create({
      data: {
        ticketId,
        uploadedById: session.user.id,
        fileName: file.name,
        fileUrl,
        storagePath,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: message };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteAttachment(attachmentId: string, ticketId: string) {
  await requireRole(["ADMINISTRADOR"]);

  const attachment = await prisma.ticketAttachment.findUnique({
    where: { id: attachmentId },
    select: { storagePath: true },
  });

  if (!attachment) return { error: "Adjunto no encontrado" };

  try {
    await deleteFile(attachment.storagePath);
    await prisma.ticketAttachment.delete({ where: { id: attachmentId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: message };
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
