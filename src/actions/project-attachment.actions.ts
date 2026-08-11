"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import {
  addFileAttachments,
  addLinkAttachments,
  deleteAttachment as removeAttachment,
  reorderAttachments,
} from "@/lib/attachments";

export async function addProjectFile(projectId: string, formData: FormData) {
  const session = await getRequiredSession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No se seleccionó ningún archivo" };
  }

  const { errors } = await addFileAttachments({
    entityType: "PROJECT",
    entityId: projectId,
    // Prefijo heredado: los archivos de proyecto viven bajo `tickets/projects/…`
    // en R2. Se mantiene para no invalidar las URLs ya guardadas.
    storageKey: `projects/${projectId}`,
    files: [file],
    uploadedById: session.user.id,
  });

  if (errors.length > 0) return { error: errors.join(" | ") };

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function addProjectLink(projectId: string, formData: FormData) {
  const session = await getRequiredSession();

  const url = (formData.get("url") as string)?.trim();
  const name = (formData.get("name") as string)?.trim();

  if (!url) return { error: "La URL es requerida" };
  if (!name) return { error: "El nombre del enlace es requerido" };

  const { error } = await addLinkAttachments({
    entityType: "PROJECT",
    entityId: projectId,
    links: [{ url, label: name }],
    uploadedById: session.user.id,
  });

  if (error) return { error: "La URL no es válida" };

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function deleteProjectAttachment(attachmentId: string, projectId: string) {
  const session = await getRequiredSession();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  const { error } = await removeAttachment(
    attachmentId,
    { entityType: "PROJECT", entityId: projectId },
    { id: session.user.id, isAdmin: user?.role === "ADMINISTRADOR" },
  );
  if (error) return { error };

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function reorderProjectAttachments(projectId: string, orderedIds: string[]) {
  await getRequiredSession();

  await reorderAttachments("PROJECT", projectId, orderedIds);

  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}
