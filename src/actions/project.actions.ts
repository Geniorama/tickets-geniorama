"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, requireRole } from "@/lib/auth-helpers";

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
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      status: parsed.data.status,
      companyId: parsed.data.companyId ?? null,
      managerId: parsed.data.managerId ?? null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });

  revalidatePath("/proyectos");
  revalidatePath(`/proyectos/${projectId}`);
  redirect(`/proyectos/${projectId}`);
}

export async function deleteProject(projectId: string) {
  await requireRole(["ADMINISTRADOR"]);
  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/proyectos");
  redirect("/proyectos");
}
