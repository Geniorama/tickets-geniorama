"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { sendPasswordResetEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
const TOKEN_TTL_HOURS = 48;

// ── Solicitar recuperación de contraseña ─────────────────────
export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email")?.toString().trim().toLowerCase() ?? "";

  if (!email) return { error: "El email es requerido" };

  // Buscar usuario — no revelar si existe o no
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true },
  });

  if (user?.isActive) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 3_600_000);

    await prisma.passwordResetToken.create({
      data: { token, userId: user.id, expiresAt },
    });

    try {
      const url = `${BASE_URL}/set-password?token=${token}`;
      await sendPasswordResetEmail({ name: user.name, email: user.email }, url);
    } catch {
      // No exponer errores de envío
    }
  }

  // Siempre devolver éxito para evitar enumeración de emails
  return { success: true };
}

// ── Cambiar contraseña desde el dashboard ────────────────────
const changeSchema = z
  .object({
    currentPassword: z.string().min(1, "La contraseña actual es requerida"),
    newPassword:     z.string().min(8, "La nueva contraseña debe tener mínimo 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export async function changePassword(formData: FormData) {
  const session = await getRequiredSession();

  const parsed = changeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword:     formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });

  if (!user) return { error: "Usuario no encontrado" };

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return { error: "La contraseña actual es incorrecta" };

  const newHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash },
  });

  return { success: true };
}
