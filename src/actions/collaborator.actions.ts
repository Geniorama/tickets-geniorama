"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff, isAdmin } from "@/lib/auth-helpers";

// Colaborador = staff (admin o colaborador). Solo staff tiene perfil público de
// agendamiento (bio + links). Un colaborador gestiona lo suyo; un admin, el de cualquiera.

type ActionResult = { error?: string; success?: boolean };

function revalidateProfilePaths(userId: string) {
  revalidatePath("/perfil");
  revalidatePath("/agendar");
  revalidatePath(`/admin/users/${userId}/edit`);
}

// ─── Biografía (self-service) ─────────────────────────────────────────────────

const bioSchema = z.object({ bio: z.string().max(2000).optional() });

export async function updateMyBio(formData: FormData): Promise<ActionResult> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const parsed = bioSchema.safeParse({ bio: formData.get("bio") || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { bio: parsed.data.bio ?? null },
  });

  revalidateProfilePaths(session.user.id);
  return { success: true };
}

// ─── Links de agendamiento ────────────────────────────────────────────────────

const linkSchema = z.object({
  title: z.string().min(1, "El título es requerido").max(120),
  description: z.string().max(500).optional(),
  url: z.string().url("URL inválida"),
  category: z.enum(["PROYECTOS", "SOPORTE"]),
});

// Devuelve el userId objetivo si la sesión puede gestionarlo (dueño o admin) y es staff.
async function resolveManageableUserId(targetUserId: string): Promise<{ userId: string } | { error: string }> {
  const session = await getRequiredSession();
  const own = session.user.id === targetUserId;
  if (!own && !isAdmin(session.user.role)) return { error: "Sin permisos" };

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true },
  });
  if (!target) return { error: "Usuario no encontrado" };
  if (!isStaff(target.role)) return { error: "Solo el staff puede tener links de agendamiento" };

  return { userId: target.id };
}

export async function createSchedulingLink(targetUserId: string, formData: FormData): Promise<ActionResult> {
  const guard = await resolveManageableUserId(targetUserId);
  if ("error" in guard) return { error: guard.error };

  const parsed = linkSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const count = await prisma.schedulingLink.count({
    where: { userId: guard.userId, category: parsed.data.category },
  });

  await prisma.schedulingLink.create({
    data: {
      userId: guard.userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      url: parsed.data.url,
      category: parsed.data.category,
      position: count,
    },
  });

  revalidateProfilePaths(guard.userId);
  return { success: true };
}

export async function updateSchedulingLink(linkId: string, formData: FormData): Promise<ActionResult> {
  const link = await prisma.schedulingLink.findUnique({
    where: { id: linkId },
    select: { userId: true },
  });
  if (!link) return { error: "Link no encontrado" };

  const guard = await resolveManageableUserId(link.userId);
  if ("error" in guard) return { error: guard.error };

  const parsed = linkSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    url: formData.get("url"),
    category: formData.get("category"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  await prisma.schedulingLink.update({
    where: { id: linkId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      url: parsed.data.url,
      category: parsed.data.category,
    },
  });

  revalidateProfilePaths(guard.userId);
  return { success: true };
}

export async function deleteSchedulingLink(linkId: string): Promise<ActionResult> {
  const link = await prisma.schedulingLink.findUnique({
    where: { id: linkId },
    select: { userId: true },
  });
  if (!link) return { error: "Link no encontrado" };

  const guard = await resolveManageableUserId(link.userId);
  if ("error" in guard) return { error: guard.error };

  await prisma.schedulingLink.delete({ where: { id: linkId } });

  revalidateProfilePaths(guard.userId);
  return { success: true };
}
