"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { isAdmin } from "@/lib/roles";
import { addFileAttachments, deleteAttachment } from "@/lib/attachments";

/**
 * Comentarios y adjuntos de un cobro.
 *
 * No hay tablas nuevas: comentarios y adjuntos viven desde la Fase 0 en tablas
 * compartidas identificadas por `entityType` + `entityId`. Aquí solo se pone el
 * guardia del módulo y se delega, que es justo para lo que se hizo así.
 *
 * Todo va acotado al cobro (`entityId`): un id de comentario suelto no puede
 * tocar el hilo de otro, ni el de un ticket.
 */

const ENTIDAD = "BILLING" as const;

/** Que el cobro exista antes de colgarle nada. */
async function existe(billingItemId: string): Promise<boolean> {
  const n = await prisma.billingItem.count({ where: { id: billingItemId } });
  return n > 0;
}

export async function addBillingComment(billingItemId: string, formData: FormData) {
  const session = await requireCan("FACTURACION", "crear");

  const body = String(formData.get("body") ?? "").trim();
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  // Un comentario vacío sin adjuntos no aporta nada; con adjuntos sí —«aquí
  // está el soporte» se entiende solo.
  if (!body && files.length === 0) return { error: "Escribe algo o adjunta un archivo" };
  if (body.length > 4000) return { error: "El comentario es demasiado largo" };

  if (!(await existe(billingItemId))) return { error: "Cobro no encontrado" };

  if (body) {
    await prisma.comment.create({
      data: {
        entityType: ENTIDAD,
        entityId: billingItemId,
        body,
        authorId: session.user.id,
        // La facturación es interna por definición: aquí no entran clientes.
        isInternal: true,
      },
    });
  }

  let errores: string[] = [];
  if (files.length > 0) {
    const r = await addFileAttachments({
      entityType: ENTIDAD,
      entityId: billingItemId,
      storageKey: "facturacion",
      files,
      uploadedById: session.user.id,
    });
    errores = r.errors;
  }

  revalidatePath(`/facturacion/${billingItemId}`);
  return errores.length > 0 ? { success: true, warning: errores.join(" · ") } : { success: true };
}

export async function deleteBillingComment(commentId: string, billingItemId: string) {
  const session = await requireCan("FACTURACION", "editar");

  // Cada quien borra lo suyo; un administrador, cualquiera. Mismo criterio que
  // en tickets y tareas: un soporte de pago no lo quita quien no lo puso.
  const donde = isAdmin(session.user.role)
    ? { id: commentId, entityType: ENTIDAD, entityId: billingItemId }
    : { id: commentId, entityType: ENTIDAD, entityId: billingItemId, authorId: session.user.id };

  const { count } = await prisma.comment.deleteMany({ where: donde });
  if (count === 0) return { error: "No se pudo eliminar ese comentario" };

  revalidatePath(`/facturacion/${billingItemId}`);
  return { success: true };
}

export async function addBillingAttachments(billingItemId: string, formData: FormData) {
  const session = await requireCan("FACTURACION", "crear");

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "No se eligió ningún archivo" };

  if (!(await existe(billingItemId))) return { error: "Cobro no encontrado" };

  const { errors } = await addFileAttachments({
    entityType: ENTIDAD,
    entityId: billingItemId,
    storageKey: "facturacion",
    files,
    uploadedById: session.user.id,
  });

  revalidatePath(`/facturacion/${billingItemId}`);
  return errors.length > 0 ? { success: true, warning: errors.join(" · ") } : { success: true };
}

export async function deleteBillingAttachment(attachmentId: string, billingItemId: string) {
  const session = await requireCan("FACTURACION", "editar");

  const r = await deleteAttachment(
    attachmentId,
    { entityType: ENTIDAD, entityId: billingItemId },
    { id: session.user.id, isAdmin: isAdmin(session.user.role) },
  );

  revalidatePath(`/facturacion/${billingItemId}`);
  return r.error ? { error: r.error } : { success: true };
}

// ─── Etiquetas ───────────────────────────────────────────────────────────────

export async function setBillingLabels(billingItemId: string, labelIds: string[]) {
  await requireCan("FACTURACION", "editar");

  if (!(await existe(billingItemId))) return { error: "Cobro no encontrado" };

  await prisma.billingItem.update({
    where: { id: billingItemId },
    // `set` reemplaza el conjunto entero: es lo que quiere decir marcar y
    // desmarcar casillas, y evita tener que calcular qué se añadió y qué no.
    data: { labels: { set: labelIds.map((id) => ({ id })) } },
  });

  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${billingItemId}`);
  return { success: true };
}

export async function createBillingLabel(name: string, color: string) {
  // Crear una etiqueta la ve todo el módulo: pide GESTOR.
  await requireCan("FACTURACION", "gestionar");

  const limpio = name.trim().slice(0, 40);
  if (!limpio) return { error: "La etiqueta necesita un nombre" };

  const ya = await prisma.billingLabel.findUnique({ where: { name: limpio }, select: { id: true } });
  // Devolver la que existe en vez de fallar: dos personas creando «Por cobrar»
  // a la vez es lo normal, y no es un error que haya que resolver.
  if (ya) return { success: true, id: ya.id };

  const ultima = await prisma.billingLabel.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const creada = await prisma.billingLabel.create({
    data: { name: limpio, color, position: (ultima?.position ?? -1) + 1 },
    select: { id: true },
  });

  revalidatePath("/facturacion");
  return { success: true, id: creada.id };
}
