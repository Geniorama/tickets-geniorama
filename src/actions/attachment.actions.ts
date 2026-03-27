"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole } from "@/lib/auth-helpers";
import { validateFile, uploadFile, deleteFile } from "@/lib/s3";

export async function addAttachment(ticketId: string, formData: FormData) {
  const session = await getRequiredSession();

  const files = formData.getAll("files") as File[];
  const validFiles = files.filter((f) => f instanceof File && f.size > 0);

  if (validFiles.length === 0) {
    return { error: "No se seleccionó ningún archivo" };
  }

  const errors: string[] = [];

  for (const file of validFiles) {
    const validationError = validateFile(file);
    if (validationError) {
      errors.push(`${file.name}: ${validationError}`);
      continue;
    }
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
      errors.push(`${file.name}: ${message}`);
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
  if (errors.length > 0) return { error: errors.join(" | ") };
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
