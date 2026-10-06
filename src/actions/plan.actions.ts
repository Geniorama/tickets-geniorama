"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity/record";
import { actualizarPlan, crearPlan, setPlanActivo } from "@/lib/admin/records";

const planSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["BOLSA_HORAS", "SOPORTE_MENSUAL"]),
  companyId: z.string().min(1, "La empresa es requerida"),
  totalHours: z.coerce.number().positive().optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  startedAt: z.string().min(1),
  expiresAt: z.string().optional(),
  prioritySupport: z.boolean(),
  aiTools: z.boolean(),
});

function parsePlanFormData(formData: FormData) {
  const type = formData.get("type") as string;
  const expiresType = formData.get("expiresType") as string;

  const raw: Record<string, unknown> = {
    name: formData.get("name"),
    type,
    companyId: formData.get("companyId"),
    startedAt: formData.get("startedAt"),
    // Casilla: solo llega en el formulario si está marcada
    prioritySupport: formData.get("prioritySupport") === "on",
    aiTools: formData.get("aiTools") === "on",
  };

  if (type === "BOLSA_HORAS") {
    const th = formData.get("totalHours");
    if (th) raw.totalHours = th;
  }

  if (expiresType === "duration") {
    const dd = formData.get("durationDays");
    if (dd) raw.durationDays = dd;
  } else if (expiresType === "date") {
    const ea = formData.get("expiresAt");
    if (ea) raw.expiresAt = ea;
  }

  return raw;
}

/** Lee y valida el formulario de un plan, que es el mismo al crear y al editar. */
function leerPlan(formData: FormData) {
  const type = formData.get("type") as string;
  const raw = parsePlanFormData(formData);

  if (type === "BOLSA_HORAS" && !raw.totalHours) {
    return { error: "El total de horas es requerido para Bolsa de Horas" } as const;
  }

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;

  const { startedAt, expiresAt, ...rest } = parsed.data;
  return {
    data: { ...rest, startedAt: new Date(startedAt), expiresAt: expiresAt ? new Date(expiresAt) : null },
  } as const;
}

export async function createPlan(formData: FormData) {
  const session = await requireCan("ADMIN");

  const leido = leerPlan(formData);
  if ("error" in leido) return { error: leido.error };

  // El guardado vive en lib/admin/records: el asistente (MCP) guarda igual
  const r = await crearPlan(session.user, leido.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/plans");
  return { success: true };
}

export async function updatePlan(planId: string, formData: FormData) {
  const session = await requireCan("ADMIN");

  const leido = leerPlan(formData);
  if ("error" in leido) return { error: leido.error };

  const r = await actualizarPlan(session.user, planId, leido.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${planId}/edit`);
  return { success: true };
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  const session = await requireCan("ADMIN");

  const r = await setPlanActivo(session.user, planId, isActive);
  if (!r.ok) return { error: r.error };

  revalidatePath("/admin/plans");
  return { success: true };
}

export async function deletePlan(planId: string) {
  const session = await requireCan("ADMIN");

  const plan = await prisma.plan.findUnique({ where: { id: planId }, select: { name: true } });

  // Nullify planId on tickets linked to this plan before deleting
  await prisma.ticket.updateMany({
    where: { planId },
    data: { planId: null },
  });

  await prisma.plan.delete({ where: { id: planId } });

  recordActivity({
    entityType: "PLAN",
    entityId: planId,
    action: "plan.deleted",
    label: plan?.name ?? null,
    actor: session.user,
  });

  revalidatePath("/admin/plans");
  redirect("/admin/plans");
}
