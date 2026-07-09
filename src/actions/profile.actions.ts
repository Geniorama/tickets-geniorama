"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { validateAvatar, uploadAvatar, deleteFile } from "@/lib/s3";

// Foto de perfil: disponible para cualquier usuario autenticado (staff o cliente).

type ActionResult = { error?: string; success?: boolean };

function revalidateAvatarPaths() {
  revalidatePath("/perfil");
  revalidatePath("/agendar");
  // El topbar (avatar) se renderiza en el layout de todo el dashboard.
  revalidatePath("/", "layout");
}

export async function updateMyAvatar(formData: FormData): Promise<ActionResult> {
  const session = await getRequiredSession();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No se seleccionó ninguna imagen" };
  }

  const err = validateAvatar(file);
  if (err) return { error: err };

  const previous = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarStoragePath: true },
  });

  const { storagePath, fileUrl } = await uploadAvatar(file, session.user.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: fileUrl, avatarStoragePath: storagePath },
  });

  // Borrar la foto anterior (best-effort — no interrumpe si falla)
  if (previous?.avatarStoragePath && previous.avatarStoragePath !== storagePath) {
    try {
      await deleteFile(previous.avatarStoragePath);
    } catch (e) {
      console.error("[updateMyAvatar] no se pudo borrar el avatar anterior:", e);
    }
  }

  revalidateAvatarPaths();
  return { success: true };
}

export async function removeMyAvatar(): Promise<ActionResult> {
  const session = await getRequiredSession();

  const previous = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarStoragePath: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: null, avatarStoragePath: null },
  });

  if (previous?.avatarStoragePath) {
    try {
      await deleteFile(previous.avatarStoragePath);
    } catch (e) {
      console.error("[removeMyAvatar] no se pudo borrar el avatar:", e);
    }
  }

  revalidateAvatarPaths();
  return { success: true };
}
