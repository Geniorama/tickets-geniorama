"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirm: z.string().min(1),
});

export async function setPassword(formData: FormData) {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { token, password, confirm } = parsed.data;

  if (password !== confirm) {
    return { error: "Las contraseñas no coinciden" };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!record) return { error: "El enlace no es válido" };
  if (record.expiresAt < new Date()) return { error: "El enlace ha expirado" };
  if (!record.user.isActive) return { error: "Esta cuenta está desactivada" };

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.delete({ where: { token } }),
  ]);

  return { success: true };
}
