import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

/** Lee `reviewerIds` (CSV) de un FormData y devuelve IDs únicos y no vacíos. */
export function parseReviewerIds(formData: FormData): string[] {
  const raw = (formData.get("reviewerIds") as string | null) ?? "";
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/**
 * Resuelve el conjunto final de revisores: filtra a usuarios activos y, si no
 * queda ninguno, usa al creador de la entrada por defecto.
 */
export async function resolveReviewerIds(
  requestedIds: string[],
  creatorId: string
): Promise<string[]> {
  let valid: string[] = [];
  if (requestedIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: requestedIds }, isActive: true },
      select: { id: true },
    });
    valid = users.map((u) => u.id);
  }
  return valid.length > 0 ? valid : [creatorId];
}

/**
 * Notifica a los revisores de un ticket/tarea cuando entra en revisión.
 * Lee la relación `reviewers` (siempre poblada, con fallback al creador) y
 * excluye a quien dispara el cambio. `skipGChat` evita duplicar el aviso al
 * canal del equipo (el cambio de estado ya lo envía aparte).
 */
export async function notifyReviewers(
  kind: "ticket" | "task",
  itemId: string,
  title: string,
  link: string,
  actorId: string,
  skipGChat?: boolean
): Promise<void> {
  let reviewerIds: string[] = [];
  if (kind === "ticket") {
    const t = await prisma.ticket.findUnique({
      where: { id: itemId },
      select: { reviewers: { select: { id: true } } },
    });
    reviewerIds = t?.reviewers.map((r) => r.id) ?? [];
  } else {
    const t = await prisma.task.findUnique({
      where: { id: itemId },
      select: { reviewers: { select: { id: true } } },
    });
    reviewerIds = t?.reviewers.map((r) => r.id) ?? [];
  }

  const recipients = reviewerIds.filter((id) => id !== actorId);
  if (recipients.length === 0) return;

  await notifyMany(
    recipients,
    kind === "ticket" ? "ticket_status" : "task_status",
    "Pendiente de tu revisión",
    `"${title}" pasó a En revisión`,
    link,
    skipGChat
  );
}
