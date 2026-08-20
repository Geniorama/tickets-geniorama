import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, dateString, readJson, requireActor } from "@/lib/api/respond";
import { getTask, updateTaskViaApi } from "@/lib/api/tasks";

/**
 * Una tarea concreta.
 *
 *   GET   /api/v1/tasks/:id
 *   PATCH /api/v1/tasks/:id   — solo los campos que se manden
 */

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).optional(),
  status: z.enum(["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"]).optional(),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  category: z.string().trim().max(80).nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  startDate: dateString.nullable().optional(),
  dueDate: dateString.nullable().optional(),
  estimatedHours: z.number().positive().max(1000).nullable().optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const task = await getTask(actor.user, id);
  if (!task) return apiError("Tarea no encontrada", 404);

  return apiOk({ task });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });
  }

  const { id } = await params;
  const { startDate, dueDate, ...rest } = parsed.data;

  const result = await updateTaskViaApi(actor.user, id, {
    ...rest,
    ...(startDate !== undefined ? { startDate: startDate === null ? null : new Date(startDate) } : {}),
    ...(dueDate !== undefined ? { dueDate: dueDate === null ? null : new Date(dueDate) } : {}),
  });

  if (!result.ok) return apiError(result.error, result.status);
  return apiOk({ task: result.value });
}
