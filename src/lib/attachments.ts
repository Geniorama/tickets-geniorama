/**
 * Núcleo compartido — adjuntos.
 *
 * Una sola implementación de adjuntos (archivos y enlaces) para cualquier
 * entidad. Antes había tres modelos, tres bloques de subida y tres formas de
 * distinguir un enlace de un archivo.
 *
 * Contrato: al no haber clave foránea sobre `entityId`, la base no borra los
 * adjuntos de una entidad eliminada. Usa `deleteAttachmentsFor()` en todo
 * camino que borre un ticket, tarea o proyecto.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";
import { validateFile, uploadFile, deleteFile } from "@/lib/s3";

export type AttachmentWithUploader = Prisma.AttachmentGetPayload<{
  include: { uploadedBy: { select: { name: true } } };
}>;

/** Un enlace nunca tiene archivo en R2 detrás. */
export function isLink(attachment: { type: string }) {
  return attachment.type === "link";
}

export function listAttachments(
  entityType: EntityType,
  entityId: string,
): Promise<AttachmentWithUploader[]> {
  return prisma.attachment.findMany({
    where: { entityType, entityId },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
}

/** Siguiente hueco de orden dentro de la entidad. */
async function nextPosition(entityType: EntityType, entityId: string) {
  const last = await prisma.attachment.findFirst({
    where: { entityType, entityId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

/**
 * Sube archivos y los registra. Devuelve los errores por archivo en vez de
 * abortar: un archivo inválido no debe tumbar la subida de los demás.
 */
export async function addFileAttachments({
  entityType,
  entityId,
  storageKey,
  files,
  uploadedById,
}: {
  entityType: EntityType;
  entityId: string;
  /** Prefijo en R2. Se mantiene el de cada módulo para no invalidar lo ya subido. */
  storageKey: string;
  files: File[];
  uploadedById: string;
}): Promise<{ errors: string[] }> {
  const errors: string[] = [];
  const valid = files.filter((f) => f instanceof File && f.size > 0);
  if (valid.length === 0) return { errors };

  let position = await nextPosition(entityType, entityId);

  for (const file of valid) {
    const validationError = validateFile(file);
    if (validationError) {
      errors.push(`${file.name}: ${validationError}`);
      continue;
    }
    try {
      const { storagePath, fileUrl } = await uploadFile(file, storageKey);
      await prisma.attachment.create({
        data: {
          entityType,
          entityId,
          type: "file",
          fileName: file.name,
          fileUrl,
          storagePath,
          position: position++,
          uploadedById,
        },
      });
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : "Error desconocido"}`);
    }
  }

  return { errors };
}

/** Registra enlaces. Devuelve el primer error de validación, si lo hay. */
export async function addLinkAttachments({
  entityType,
  entityId,
  links,
  uploadedById,
}: {
  entityType: EntityType;
  entityId: string;
  links: { url?: string; label?: string }[];
  uploadedById: string;
}): Promise<{ error?: string }> {
  let position = await nextPosition(entityType, entityId);
  const data = [];

  for (const { url, label } of links) {
    const trimmed = (url ?? "").trim();
    if (!trimmed) continue;
    try {
      new URL(trimmed);
    } catch {
      return { error: `Enlace inválido: ${trimmed}` };
    }
    data.push({
      entityType,
      entityId,
      type: "link",
      fileName: label?.trim() || trimmed,
      fileUrl: trimmed,
      storagePath: null,
      position: position++,
      uploadedById,
    });
  }

  if (data.length > 0) await prisma.attachment.createMany({ data });
  return {};
}

/**
 * Borra un adjunto y, si era archivo, su objeto en R2.
 * `allowedEntity` limita el borrado a la entidad esperada, para que un id
 * suelto no permita borrar el adjunto de otra cosa.
 */
export async function deleteAttachment(
  attachmentId: string,
  allowedEntity: { entityType: EntityType; entityId: string },
  actor: { id: string; isAdmin: boolean },
): Promise<{ error?: string }> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, ...allowedEntity },
    select: { id: true, type: true, storagePath: true, uploadedById: true },
  });

  if (!attachment) return { error: "Adjunto no encontrado" };
  if (!actor.isAdmin && attachment.uploadedById !== actor.id) {
    return { error: "Sin permiso para eliminar este adjunto" };
  }

  try {
    if (!isLink(attachment) && attachment.storagePath) {
      await deleteFile(attachment.storagePath);
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }

  return {};
}

/**
 * Reordena los adjuntos de una entidad.
 * El `updateMany` va acotado por entidad a propósito: así un id ajeno enviado
 * desde el cliente no altera el orden de otro proyecto.
 */
export async function reorderAttachments(
  entityType: EntityType,
  entityId: string,
  orderedIds: string[],
) {
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.attachment.updateMany({
        where: { id, entityType, entityId },
        data: { position: index },
      }),
    ),
  );
}

/**
 * Reemplazo del borrado en cascada que daba la clave foránea.
 *
 * Solo borra los registros: los objetos en R2 se quedan, que es exactamente lo
 * que pasaba antes cuando la cascada de la base eliminaba las filas.
 */
export function deleteAttachmentsFor(
  entityType: EntityType,
  entityIds: string | string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return Promise.resolve({ count: 0 });

  return client.attachment.deleteMany({
    where: { entityType, entityId: { in: ids } },
  });
}
