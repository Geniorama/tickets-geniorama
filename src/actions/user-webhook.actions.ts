"use server";

import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { NOTIFICATION_CATEGORY_KEYS } from "@/lib/notification-categories";
import { sendTestWebhook } from "@/lib/user-webhooks";

export type UserWebhookItem = {
  id: string;
  label: string | null;
  url: string;
  secret: string | null;
  events: string[];
  isActive: boolean;
  lastStatus: number | null;
  lastError: string | null;
  lastSentAt: Date | null;
};

const MAX_WEBHOOKS = 10;

const webhookSchema = z.object({
  label: z.string().trim().max(80).optional(),
  url: z.string().trim().url("La URL no es válida").max(2048),
  events: z.array(z.enum(NOTIFICATION_CATEGORY_KEYS as [string, ...string[]])).min(1, "Selecciona al menos una categoría"),
  isActive: z.boolean().optional(),
});

export async function getMyWebhooks(): Promise<UserWebhookItem[]> {
  const session = await getRequiredSession();
  return prisma.userWebhook.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true, label: true, url: true, secret: true, events: true,
      isActive: true, lastStatus: true, lastError: true, lastSentAt: true,
    },
  });
}

export async function createWebhook(input: {
  label?: string;
  url: string;
  events: string[];
}): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const count = await prisma.userWebhook.count({ where: { userId: session.user.id } });
  if (count >= MAX_WEBHOOKS) return { error: `Máximo ${MAX_WEBHOOKS} webhooks por usuario.` };

  try {
    await prisma.userWebhook.create({
      data: {
        userId: session.user.id,
        label: parsed.data.label || null,
        url: parsed.data.url,
        events: parsed.data.events,
        secret: crypto.randomBytes(24).toString("hex"),
      },
    });
    revalidatePath("/integraciones");
    return {};
  } catch {
    return { error: "No se pudo crear el webhook." };
  }
}

export async function updateWebhook(
  id: string,
  input: { label?: string; url: string; events: string[]; isActive?: boolean }
): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  const parsed = webhookSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  try {
    const result = await prisma.userWebhook.updateMany({
      where: { id, userId: session.user.id },
      data: {
        label: parsed.data.label || null,
        url: parsed.data.url,
        events: parsed.data.events,
        isActive: parsed.data.isActive ?? true,
      },
    });
    if (result.count === 0) return { error: "Webhook no encontrado." };
    revalidatePath("/integraciones");
    return {};
  } catch {
    return { error: "No se pudo actualizar el webhook." };
  }
}

export async function toggleWebhook(id: string, isActive: boolean): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  try {
    await prisma.userWebhook.updateMany({
      where: { id, userId: session.user.id },
      data: { isActive },
    });
    revalidatePath("/integraciones");
    return {};
  } catch {
    return { error: "No se pudo actualizar el webhook." };
  }
}

export async function deleteWebhook(id: string): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  try {
    await prisma.userWebhook.deleteMany({ where: { id, userId: session.user.id } });
    revalidatePath("/integraciones");
    return {};
  } catch {
    return { error: "No se pudo eliminar el webhook." };
  }
}

export async function testWebhook(id: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const session = await getRequiredSession();
  const hook = await prisma.userWebhook.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, url: true, secret: true },
  });
  if (!hook) return { ok: false, error: "Webhook no encontrado." };
  const res = await sendTestWebhook(hook);
  revalidatePath("/integraciones");
  return res;
}
