"use server";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { sendInvitationEmail } from "@/lib/email";

const BASE_URL = process.env.AUTH_URL ?? "http://localhost:3000";
const TOKEN_TTL_HOURS = 48;

export async function generateInvitationToken(userId: string): Promise<string> {
  // Eliminar tokens anteriores del usuario
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { token, userId, expiresAt },
  });

  return token;
}

export async function resendInvitation(userId: string) {
  await requireRole(["ADMINISTRADOR"]);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  if (!user) return { error: "Usuario no encontrado" };

  try {
    const token = await generateInvitationToken(userId);
    const url = `${BASE_URL}/set-password?token=${token}`;
    await sendInvitationEmail({ name: user.name, email: user.email }, url);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al enviar email";
    return { error: message };
  }

  return { success: true };
}
