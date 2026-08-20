"use server";

/**
 * Administración de hooks desde el panel.
 *
 * Dos alcances, dos permisos: los hooks de organización los gobierna quien
 * administra la plataforma; los de un proyecto, quien gestiona proyectos. La
 * frontera importa porque un hook de organización recibe *todo* lo que pasa,
 * incluidos los tickets de todos los clientes.
 */

import crypto from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { allowedEventsFor, HOOK_EVENT_KEYS } from "@/lib/hooks/events";
import { sendTestHook } from "@/lib/hooks/dispatch";

export type HookItem = {
  id: string;
  label: string;
  url: string;
  secret: string;
  events: string[];
  scope: "ORG" | "PROJECT";
  projectId: string | null;
  isActive: boolean;
  lastStatus: number | null;
  lastError: string | null;
  lastSentAt: Date | null;
};

export type HookDeliveryItem = {
  id: string;
  event: string;
  status: number | null;
  error: string | null;
  durationMs: number | null;
  attempts: number;
  createdAt: Date;
};

const MAX_HOOKS_PER_SCOPE = 20;

const hookSchema = z.object({
  label: z.string().trim().min(1, "Ponle un nombre al hook").max(80),
  url: z.string().trim().url("La URL no es válida").max(2048),
  events: z.array(z.string()).min(1, "Selecciona al menos un evento"),
});

const selection = {
  id: true,
  label: true,
  url: true,
  secret: true,
  events: true,
  scope: true,
  projectId: true,
  isActive: true,
  lastStatus: true,
  lastError: true,
  lastSentAt: true,
} as const;

/**
 * Autoriza según el alcance y devuelve la ruta a revalidar.
 *
 * Se resuelve en un solo sitio para que ninguna acción se olvide de comprobar
 * el permiso del alcance que está tocando.
 */
async function authorize(scope: "ORG" | "PROJECT", projectId: string | null) {
  if (scope === "PROJECT") {
    if (!projectId) throw new Error("Un hook de proyecto necesita proyecto");
    await requireCan("PROYECTOS", "gestionar");
    return `/proyectos/${projectId}/integraciones`;
  }
  await requireCan("ADMIN", "gestionar");
  return "/admin/integraciones";
}

function cleanEvents(events: string[], scope: "ORG" | "PROJECT"): string[] {
  const allowed = new Set(allowedEventsFor(scope));
  return [...new Set(events)].filter((e) => allowed.has(e) && HOOK_EVENT_KEYS.includes(e));
}

// ─── Lectura ─────────────────────────────────────────────────────────────────

export async function getOrgHooks(): Promise<HookItem[]> {
  await requireCan("ADMIN", "gestionar");
  return prisma.hook.findMany({
    where: { scope: "ORG" },
    orderBy: { createdAt: "asc" },
    select: selection,
  });
}

export async function getProjectHooks(projectId: string): Promise<HookItem[]> {
  await requireCan("PROYECTOS", "gestionar");
  return prisma.hook.findMany({
    where: { scope: "PROJECT", projectId },
    orderBy: { createdAt: "asc" },
    select: selection,
  });
}

export async function getHookDeliveries(hookId: string): Promise<HookDeliveryItem[]> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { scope: true, projectId: true },
  });
  if (!hook) return [];
  await authorize(hook.scope, hook.projectId);

  return prisma.hookDelivery.findMany({
    where: { hookId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      event: true,
      status: true,
      error: true,
      durationMs: true,
      attempts: true,
      createdAt: true,
    },
  });
}

// ─── Escritura ───────────────────────────────────────────────────────────────

export async function createHook(input: {
  label: string;
  url: string;
  events: string[];
  scope: "ORG" | "PROJECT";
  projectId?: string | null;
}): Promise<{ error?: string }> {
  const projectId = input.scope === "PROJECT" ? (input.projectId ?? null) : null;
  const path = await authorize(input.scope, projectId);
  const session = await requireCan(input.scope === "PROJECT" ? "PROYECTOS" : "ADMIN", "gestionar");

  const parsed = hookSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const events = cleanEvents(parsed.data.events, input.scope);
  if (events.length === 0) return { error: "Ninguno de esos eventos aplica a este alcance" };

  const count = await prisma.hook.count({
    where: input.scope === "PROJECT" ? { projectId } : { scope: "ORG" },
  });
  if (count >= MAX_HOOKS_PER_SCOPE) {
    return { error: `Máximo ${MAX_HOOKS_PER_SCOPE} hooks. Elimina alguno antes de crear otro.` };
  }

  try {
    await prisma.hook.create({
      data: {
        label: parsed.data.label,
        url: parsed.data.url,
        // El secreto se genera aquí y no lo elige nadie: un secreto escrito a
        // mano acaba siendo «geniorama123» y la firma deja de valer para nada.
        secret: crypto.randomBytes(32).toString("base64url"),
        events,
        scope: input.scope,
        projectId,
        createdById: session.user.id,
      },
    });
  } catch {
    return { error: "No se pudo crear el hook" };
  }

  revalidatePath(path);
  return {};
}

export async function updateHook(
  hookId: string,
  input: { label: string; url: string; events: string[] },
): Promise<{ error?: string }> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { scope: true, projectId: true },
  });
  if (!hook) return { error: "El hook ya no existe" };
  const path = await authorize(hook.scope, hook.projectId);

  const parsed = hookSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const events = cleanEvents(parsed.data.events, hook.scope);
  if (events.length === 0) return { error: "Ninguno de esos eventos aplica a este alcance" };

  await prisma.hook.update({
    where: { id: hookId },
    data: { label: parsed.data.label, url: parsed.data.url, events },
  });

  revalidatePath(path);
  return {};
}

export async function toggleHook(hookId: string, isActive: boolean): Promise<{ error?: string }> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { scope: true, projectId: true },
  });
  if (!hook) return { error: "El hook ya no existe" };
  const path = await authorize(hook.scope, hook.projectId);

  await prisma.hook.update({ where: { id: hookId }, data: { isActive } });
  revalidatePath(path);
  return {};
}

export async function deleteHook(hookId: string): Promise<{ error?: string }> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { scope: true, projectId: true },
  });
  if (!hook) return { error: "El hook ya no existe" };
  const path = await authorize(hook.scope, hook.projectId);

  await prisma.hook.delete({ where: { id: hookId } });
  revalidatePath(path);
  return {};
}

/** Manda un evento `ping` de prueba y devuelve qué contestó el destino. */
export async function testHook(
  hookId: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const hook = await prisma.hook.findUnique({
    where: { id: hookId },
    select: { id: true, url: true, secret: true, scope: true, projectId: true },
  });
  if (!hook) return { ok: false, error: "El hook ya no existe" };
  const path = await authorize(hook.scope, hook.projectId);

  const result = await sendTestHook({ id: hook.id, url: hook.url, secret: hook.secret });
  revalidatePath(path);
  return result;
}
