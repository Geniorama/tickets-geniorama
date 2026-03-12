"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { validateFile, uploadFile, deleteFile } from "@/lib/s3";

export async function addProjectFile(projectId: string, formData: FormData) {
  const session = await getRequiredSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No se seleccionó ningún archivo" };
  }

  const validationError = validateFile(file);
  if (validationError) return { error: validationError };

  try {
    const { storagePath, fileUrl } = await uploadFile(file, `projects/${projectId}`);

    await prisma.projectAttachment.create({
      data: {
        type: "file",
        projectId,
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

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function addProjectLink(projectId: string, formData: FormData) {
  const session = await getRequiredSession();

  const url = (formData.get("url") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();

  if (!url) return { error: "La URL es requerida" };
  if (!name) return { error: "El nombre del enlace es requerido" };

  try {
    new URL(url);
  } catch {
    return { error: "La URL no es válida" };
  }

  try {
    await prisma.projectAttachment.create({
      data: {
        type: "link",
        projectId,
        uploadedById: session.user.id,
        fileName: name,
        fileUrl: url,
        storagePath: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: message };
  }

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function deleteProjectAttachment(attachmentId: string, projectId: string) {
  const session = await getRequiredSession();

  const attachment = await prisma.projectAttachment.findUnique({
    where: { id: attachmentId },
    select: { storagePath: true, type: true, uploadedById: true },
  });

  if (!attachment) return { error: "Adjunto no encontrado" };

  // Solo el creador o un admin puede borrar
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isAdmin = user?.role === "ADMINISTRADOR";
  if (!isAdmin && attachment.uploadedById !== session.user.id) {
    return { error: "Sin permiso para eliminar este adjunto" };
  }

  try {
    if (attachment.type === "file" && attachment.storagePath) {
      await deleteFile(attachment.storagePath);
    }
    await prisma.projectAttachment.delete({ where: { id: attachmentId } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { error: message };
  }

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}
