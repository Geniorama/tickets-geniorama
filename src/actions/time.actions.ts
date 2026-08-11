"use server";

import { revalidatePath } from "next/cache";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { canAccessTicket } from "@/lib/ticket-access";
import type { EntityType } from "@/generated/prisma";
import * as time from "@/lib/time-entries";

/** Contrato de estas acciones: los componentes leen `result?.error`. */
type TimerResult = { error?: string; success?: boolean };

/** Solo el staff con acceso al ticket puede cronometrar sobre él. */
async function guard(ticketId: string, requireAdmin = false) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return null;
  if (requireAdmin && !isAdmin(session.user.role)) return null;

  const allowed = await canAccessTicket(ticketId, session.user.id, session.user.role);
  if (!allowed) return null;

  return {
    userId: session.user.id,
    entity: { entityType: "TICKET" as EntityType, entityId: ticketId },
  };
}

export async function startTimer(ticketId: string): Promise<TimerResult> {
  const ctx = await guard(ticketId);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.startTimer(ctx.entity, ctx.userId);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function pauseTimer(ticketId: string): Promise<TimerResult> {
  const ctx = await guard(ticketId);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.pauseTimer(ctx.entity);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function deleteTimeEntry(entryId: string, ticketId: string): Promise<TimerResult> {
  const ctx = await guard(ticketId, true);
  if (!ctx) return { error: "Sin permisos" };

  await time.deleteTimeEntry(ctx.entity, entryId);

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function resetTimeEntries(ticketId: string): Promise<TimerResult> {
  const ctx = await guard(ticketId, true);
  if (!ctx) return { error: "Sin permisos" };

  await time.resetTimeEntries(ctx.entity);

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}

export async function addManualEntry(ticketId: string, hours: number, minutes: number): Promise<TimerResult> {
  const ctx = await guard(ticketId, true);
  if (!ctx) return { error: "Sin permisos" };

  const result = await time.addManualEntry(ctx.entity, ctx.userId, hours, minutes);
  if (result.error) return result;

  revalidatePath(`/tickets/${ticketId}`);
  return { success: true };
}
