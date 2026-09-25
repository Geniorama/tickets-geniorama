"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { deleteCommentsFor } from "@/lib/comments";
import { deleteAttachmentsFor } from "@/lib/attachments";
import { deleteChecklistsFor } from "@/lib/checklists";
import { deleteVaultLinksFor } from "@/lib/vault-links";
import { deleteTimeEntriesFor } from "@/lib/time-entries";
import { emitDeletedHook, emitProjectHook } from "@/lib/hooks/dispatch";
import { projectPayload } from "@/lib/hooks/payload";
import { diffFields, recordActivity } from "@/lib/activity/record";

const projectSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  // Activo / Inactivo. El borrador va aparte: se decide al crear y se quita al publicar.
  isActive: z.boolean().default(true),
  companyId: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(z.string()).default([]),
});

export async function createProject(formData: FormData) {
  const session = await getRequiredSession();
  await requireCan("PROYECTOS", "gestionar");

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    // Casilla/selector: sin valor explícito, activo
    isActive: formData.get("isActive") !== "false",
    companyId: formData.get("companyId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    isPrivate: formData.get("isPrivate") === "true",
    memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Borrador: solo lo ve quien lo crea —con sus tareas— hasta publicarlo
  const isDraft = formData.get("isDraft") === "true";

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isActive: parsed.data.isActive,
      isDraft,
      companyId: parsed.data.companyId ?? null,
      managerId: parsed.data.managerId ?? null,
      createdById: session.user.id,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      isPrivate: parsed.data.isPrivate,
      members: parsed.data.isPrivate && parsed.data.memberIds.length > 0
        ? { create: parsed.data.memberIds.map((userId) => ({ userId })) }
        : undefined,
    },
  });

  // Un borrador no sale de la plataforma ni entra al historial hasta publicarse:
  // «creó el proyecto» se registra al publicar.
  if (!isDraft) {
    emitProjectHook("project.created", project.id, {
      actor: session.user,
      isPrivate: project.isPrivate,
    });
  }

  revalidatePath("/proyectos");
  redirect(`/proyectos/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  const session = await requireCan("PROYECTOS", "gestionar");

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    // Casilla/selector: sin valor explícito, activo
    isActive: formData.get("isActive") !== "false",
    companyId: formData.get("companyId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    isPrivate: formData.get("isPrivate") === "true",
    memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Se lee todo lo que el historial vigila, no solo el estado: sin la foto
  // previa completa, «editó el proyecto» no puede decir qué editó.
  const before = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isActive: true, isDraft: true, createdById: true, name: true, startDate: true, dueDate: true, isPrivate: true },
  });
  if (!before) return { error: "Proyecto no encontrado" };
  // Un borrador ajeno ni se ve: tampoco se edita
  if (before.isDraft && before.createdById !== session.user.id) return { error: "Proyecto no encontrado" };

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isActive: parsed.data.isActive,
        companyId: parsed.data.companyId ?? null,
        managerId: parsed.data.managerId ?? null,
        startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        isPrivate: parsed.data.isPrivate,
      },
    });
    // Sync members: delete all + re-create
    await tx.projectMember.deleteMany({ where: { projectId } });
    if (parsed.data.isPrivate && parsed.data.memberIds.length > 0) {
      await tx.projectMember.createMany({
        data: parsed.data.memberIds.map((userId) => ({ projectId, userId })),
      });
    }
  });

  // Mientras es borrador no hay historial ni webhooks: todo empieza al publicar
  if (!before.isDraft && before.isActive !== parsed.data.isActive) {
    emitProjectHook("project.status_changed", projectId, {
      actor: session.user,
      isPrivate: parsed.data.isPrivate,
      // Mismo evento y mismo campo que antes; los valores ahora son
      // ACTIVO / INACTIVO (ver lib/project-state).
      changes: {
        status: {
          from: before.isActive ? "ACTIVO" : "INACTIVO",
          to: parsed.data.isActive ? "ACTIVO" : "INACTIVO",
        },
      },
    });
  }
  if (!before.isDraft) emitProjectHook("project.updated", projectId, {
    actor: session.user,
    isPrivate: parsed.data.isPrivate,
    // El estado ya salió en su propio evento; aquí van el resto de campos. Si
    // no cambió ninguno, el historial descarta la entrada por su cuenta.
    changes: diffFields("PROJECT", before, {
      name: parsed.data.name,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      isPrivate: parsed.data.isPrivate,
    }),
  });

  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}`);
}

/**
 * Publica un borrador: desde ahora lo ve quien lo vería según las reglas de
 * siempre, con sus tareas. Es el momento en que «se crea» para los demás, así
 * que aquí salen el historial y el webhook de creación.
 */
export async function publishProject(projectId: string) {
  const session = await requireCan("PROYECTOS", "gestionar");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { isDraft: true, createdById: true },
  });
  if (!project) return { error: "Proyecto no encontrado" };
  if (project.createdById !== session.user.id) return { error: "Sin permisos" };
  if (!project.isDraft) return { error: "El proyecto ya está publicado" };

  const published = await prisma.project.update({
    where: { id: projectId },
    data: { isDraft: false },
    select: { isPrivate: true },
  });

  emitProjectHook("project.created", projectId, {
    actor: session.user,
    isPrivate: published.isPrivate,
  });

  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${projectId}`);
  return { success: true };
}

export async function deleteProject(projectId: string) {
  const session = await requireCan("PROYECTOS", "gestionar");

  // El retrato se toma antes de borrar; después el proyecto ya no existe y sus
  // hooks se van con él (cascada), así que este es el último aviso que sale.
  const snapshot = await projectPayload(projectId);
  // Un borrador ajeno no existe para quien lo intenta borrar
  if (snapshot?.isDraft && snapshot.createdBy?.id !== session.user.id) return { error: "Proyecto no encontrado" };

  // Borrar el proyecto arrastra sus tareas en cascada, pero los comentarios son
  // polimórficos y no tienen clave foránea: hay que recogerlos antes de que las
  // tareas desaparezcan y quedarnos sin forma de identificarlos.
  const taskIds = await prisma.task
    .findMany({ where: { projectId }, select: { id: true } })
    .then((rows) => rows.map((t) => t.id));

  await prisma.$transaction(async (tx) => {
    await deleteCommentsFor("TASK", taskIds, tx);
    await deleteCommentsFor("PROJECT", projectId, tx);
    await deleteAttachmentsFor("TASK", taskIds, tx);
    await deleteChecklistsFor("TASK", taskIds, tx);
    await deleteTimeEntriesFor("TASK", taskIds, tx);
    await deleteAttachmentsFor("PROJECT", projectId, tx);
    await deleteVaultLinksFor("PROJECT", projectId, tx);
    await tx.project.delete({ where: { id: projectId } });
  });

  // Sin `projectId`: los hooks del proyecto se fueron con él en cascada, así que
  // el aviso solo puede salir por los de organización — y por eso un proyecto
  // privado no lo manda: su nombre no debe aparecer en un canal general.
  // Un borrador tampoco: nunca salió de la plataforma, no hay nada que avisar.
  if (snapshot && !snapshot.isPrivate && !snapshot.isDraft) {
    emitDeletedHook("project.deleted", snapshot, {
      actor: session.user,
      entity: { type: "PROJECT", id: projectId, label: snapshot.name },
    });
  } else if (snapshot) {
    // El proyecto privado no sale hacia afuera, pero sí queda en el historial:
    // «quién borró aquello» es una pregunta interna, y precisamente en lo
    // privado es donde más se hace.
    recordActivity({
      entityType: "PROJECT",
      entityId: projectId,
      action: "project.deleted",
      label: snapshot.name,
      actor: session.user,
    });
  }

  revalidatePath("/proyectos");
  redirect("/proyectos");
}

export async function toggleProjectFavorite(projectId: string) {
  const session = await getRequiredSession();
  const userId = session.user.id;

  const existing = await prisma.projectFavorite.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { projectId: true },
  });

  if (existing) {
    await prisma.projectFavorite.delete({
      where: { projectId_userId: { projectId, userId } },
    });
  } else {
    await prisma.projectFavorite.create({
      data: { projectId, userId },
    });
  }

  revalidatePath("/proyectos");
  revalidatePath("/dashboard");
  return { favorited: !existing };
}
