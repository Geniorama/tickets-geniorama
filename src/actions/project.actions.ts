"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole } from "@/lib/auth-helpers";
import { deleteCommentsFor } from "@/lib/comments";
import { deleteAttachmentsFor } from "@/lib/attachments";
import { deleteChecklistsFor } from "@/lib/checklists";
import { deleteVaultLinksFor } from "@/lib/vault-links";
import { deleteTimeEntriesFor } from "@/lib/time-entries";

const projectSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().min(1, "La descripción es requerida"),
  status: z
    .enum(["PLANIFICACION", "EN_DESARROLLO", "EN_REVISION", "COMPLETADO", "PAUSADO"])
    .default("PLANIFICACION"),
  companyId: z.string().optional(),
  managerId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  isPrivate: z.boolean().default(false),
  memberIds: z.array(z.string()).default([]),
});

export async function createProject(formData: FormData) {
  const session = await getRequiredSession();
  await requireRole(["ADMINISTRADOR"]);

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status") || "PLANIFICACION",
    companyId: formData.get("companyId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    isPrivate: formData.get("isPrivate") === "true",
    memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
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

  revalidatePath("/proyectos");
  redirect(`/proyectos/${project.id}`);
}

export async function updateProject(projectId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const parsed = projectSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    status: formData.get("status") || "PLANIFICACION",
    companyId: formData.get("companyId") || undefined,
    managerId: formData.get("managerId") || undefined,
    startDate: formData.get("startDate") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    isPrivate: formData.get("isPrivate") === "true",
    memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
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

  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}`);
}

export async function deleteProject(projectId: string) {
  await requireRole(["ADMINISTRADOR"]);

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
