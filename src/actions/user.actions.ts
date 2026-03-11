"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { generateInvitationToken } from "@/actions/invitation.actions";
import { sendInvitationEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";

const createUserSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["ADMINISTRADOR", "COLABORADOR", "CLIENTE"]),
  companyIds: z.array(z.string()).optional(),
});

export async function createUser(formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const companyIds = (formData.getAll("companyIds") as string[]).filter(Boolean);

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    companyIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  if (parsed.data.role === "CLIENTE" && (!parsed.data.companyIds || parsed.data.companyIds.length === 0)) {
    return { error: "Los usuarios de tipo Cliente deben tener al menos una empresa asignada" };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "Ya existe un usuario con ese email" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: parsed.data.role,
      companies: {
        connect: (parsed.data.companyIds ?? []).map((id) => ({ id })),
      },
    },
  });

  // Enviar email de invitación
  try {
    const token = await generateInvitationToken(user.id);
    const url = `${BASE_URL}/set-password?token=${token}`;
    await sendInvitationEmail({ name: user.name, email: user.email }, url);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createUser] Error enviando email:", message);
    revalidatePath("/admin/users");
    return { success: true, emailError: `Usuario creado, pero falló el email: ${message}` };
  }

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUser(userId: string, formData: FormData) {
  await requireRole(["ADMINISTRADOR"]);

  const companyIds = (formData.getAll("companyIds") as string[]).filter(Boolean);

  const schema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    email: z.string().email("Email inválido"),
    role: z.enum(["ADMINISTRADOR", "COLABORADOR", "CLIENTE"]),
    companyIds: z.array(z.string()).optional(),
    isActive: z.boolean(),
    password: z.string().optional(),
  });

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
    companyIds,
    isActive: formData.get("isActive") === "true",
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  if (parsed.data.role === "CLIENTE" && (!parsed.data.companyIds || parsed.data.companyIds.length === 0)) {
    return { error: "Los usuarios de tipo Cliente deben tener al menos una empresa asignada" };
  }

  const duplicate = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id: userId } },
  });
  if (duplicate) return { error: "Ya existe un usuario con ese email" };

  const updateData: Parameters<typeof prisma.user.update>[0]["data"] = {
    name: parsed.data.name,
    email: parsed.data.email,
    role: parsed.data.role,
    isActive: parsed.data.isActive,
    companies: {
      set: (parsed.data.companyIds ?? []).map((id) => ({ id })),
    },
  };

  if (parsed.data.password && parsed.data.password.length >= 8) {
    updateData.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}/edit`);
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  await requireRole(["ADMINISTRADOR"]);

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const session = await requireRole(["ADMINISTRADOR"]);

  if (session.user.id === userId) {
    return { error: "No puedes eliminar tu propio usuario." };
  }

  const counts = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      _count: {
        select: {
          createdTickets: true,
          assignedTickets: true,
          clientTickets: true,
          comments: true,
          createdProjects: true,
          managedProjects: true,
          createdTasks: true,
          assignedTasks: true,
          taskComments: true,
        },
      },
    },
  });

  if (!counts) return { error: "Usuario no encontrado." };

  const total = Object.values(counts._count).reduce((sum, n) => sum + n, 0);
  if (total > 0) {
    return {
      error:
        "No se puede eliminar el usuario porque tiene datos asociados (tickets, proyectos, comentarios, etc.). Desactívalo en su lugar.",
    };
  }

  await prisma.user.delete({ where: { id: userId } });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
