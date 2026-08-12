"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/access/can";
import { getRequiredSession } from "@/lib/auth-helpers";
import { normalizeBriefType } from "@/lib/brief-routing";

/**
 * Reglas de enrutamiento de briefs: qué responsable recibe la tarea según el
 * `briefType` que manda n8n. La pantalla vive en /admin/integraciones.
 */

const routingSchema = z.object({
  briefType:      z.string().min(1, "El tipo de brief es requerido").max(80),
  label:          z.string().min(1, "El nombre es requerido").max(120),
  assignedToId:   z.string().min(1, "El responsable es requerido"),
  priority:       z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).default("MEDIA"),
  category:       z.string().max(80).optional(),
  estimatedHours: z.coerce.number().positive().max(999).optional(),
  isActive:       z.boolean().default(true),
});

export type BriefRoutingInput = z.input<typeof routingSchema>;

async function requireAdmin(): Promise<{ error?: string }> {
  const session = await getRequiredSession();
  if (!(await can(session.user, "ADMIN", "gestionar"))) return { error: "Sin permisos" };
  return {};
}

export async function createBriefRouting(input: BriefRoutingInput): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (guard.error) return guard;

  const parsed = routingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const briefType = normalizeBriefType(parsed.data.briefType);

  const clash = await prisma.briefRouting.findUnique({ where: { briefType } });
  if (clash) return { error: `Ya existe una regla para el tipo "${briefType}".` };

  await prisma.briefRouting.create({
    data: {
      briefType,
      label:          parsed.data.label,
      assignedToId:   parsed.data.assignedToId,
      priority:       parsed.data.priority,
      category:       parsed.data.category?.trim() || null,
      estimatedHours: parsed.data.estimatedHours ?? null,
      isActive:       parsed.data.isActive,
    },
  });

  revalidatePath("/admin/integraciones");
  return {};
}

export async function updateBriefRouting(
  id: string,
  input: BriefRoutingInput,
): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (guard.error) return guard;

  const parsed = routingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const briefType = normalizeBriefType(parsed.data.briefType);

  const clash = await prisma.briefRouting.findUnique({ where: { briefType } });
  if (clash && clash.id !== id) return { error: `Ya existe una regla para el tipo "${briefType}".` };

  await prisma.briefRouting.update({
    where: { id },
    data: {
      briefType,
      label:          parsed.data.label,
      assignedToId:   parsed.data.assignedToId,
      priority:       parsed.data.priority,
      category:       parsed.data.category?.trim() || null,
      estimatedHours: parsed.data.estimatedHours ?? null,
      isActive:       parsed.data.isActive,
    },
  });

  revalidatePath("/admin/integraciones");
  return {};
}

export async function deleteBriefRouting(id: string): Promise<{ error?: string }> {
  const guard = await requireAdmin();
  if (guard.error) return guard;

  await prisma.briefRouting.delete({ where: { id } });

  revalidatePath("/admin/integraciones");
  return {};
}
