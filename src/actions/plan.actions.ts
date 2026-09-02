"use server";

import { revalidatePath } from "next/cache";
import { requireCan } from "@/lib/access/can";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordActivity } from "@/lib/activity/record";

const planSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["BOLSA_HORAS", "SOPORTE_MENSUAL"]),
  companyId: z.string().min(1, "La empresa es requerida"),
  totalHours: z.coerce.number().positive().optional(),
  durationDays: z.coerce.number().int().positive().optional(),
  startedAt: z.string().min(1),
  expiresAt: z.string().optional(),
});

function parsePlanFormData(formData: FormData) {
  const type = formData.get("type") as string;
  const expiresType = formData.get("expiresType") as string;

  const raw: Record<string, unknown> = {
    name: formData.get("name"),
    type,
    companyId: formData.get("companyId"),
    startedAt: formData.get("startedAt"),
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

export async function createPlan(formData: FormData) {
  const session = await requireCan("ADMIN");

  const type = formData.get("type") as string;
  const raw = parsePlanFormData(formData);

  if (type === "BOLSA_HORAS" && !raw.totalHours) {
    return { error: "El total de horas es requerido para Bolsa de Horas" };
  }

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { startedAt, expiresAt, ...rest } = parsed.data;

  const plan = await prisma.plan.create({
    data: {
      ...rest,
      startedAt: new Date(startedAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
    select: { id: true, name: true },
  });

  recordActivity({
    entityType: "PLAN",
    entityId: plan.id,
    action: "plan.created",
    label: plan.name,
    actor: session.user,
  });

  revalidatePath("/admin/plans");
  return { success: true };
}

export async function updatePlan(planId: string, formData: FormData) {
  const session = await requireCan("ADMIN");

  const type = formData.get("type") as string;
  const raw = parsePlanFormData(formData);

  if (type === "BOLSA_HORAS" && !raw.totalHours) {
    return { error: "El total de horas es requerido para Bolsa de Horas" };
  }

  const parsed = planSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { startedAt, expiresAt, ...rest } = parsed.data;

  await prisma.plan.update({
    where: { id: planId },
    data: {
      ...rest,
      startedAt: new Date(startedAt),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      // Clear durationDays if not provided
      durationDays: rest.durationDays ?? null,
      // Clear totalHours if not BOLSA_HORAS
      totalHours: type === "BOLSA_HORAS" ? (rest.totalHours ?? null) : null,
    },
  });

  recordActivity({
    entityType: "PLAN",
    entityId: planId,
    action: "plan.updated",
    label: rest.name,
    // Un plan es todo condiciones —horas, duración, vigencia— y compararlas
    // campo a campo llenaría el historial de ruido. Basta con saber quién lo
    // tocó y cuándo: la ficha guarda el estado actual.
    force: true,
    actor: session.user,
  });

  revalidatePath("/admin/plans");
  revalidatePath(`/admin/plans/${planId}/edit`);
  return { success: true };
}

export async function togglePlanActive(planId: string, isActive: boolean) {
  const session = await requireCan("ADMIN");

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: { isActive },
    select: { name: true },
  });

  recordActivity({
    entityType: "PLAN",
    entityId: planId,
    action: "plan.updated",
    label: plan.name,
    changes: { isActive: { from: !isActive, to: isActive } },
    actor: session.user,
  });

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
