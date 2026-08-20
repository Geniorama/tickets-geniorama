import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiOk,
  dateString,
  readJson,
  readPagination,
  requireActor,
  resolveActingUser,
} from "@/lib/api/respond";
import { createTaskViaApi, listTasks } from "@/lib/api/tasks";

/**
 * Tareas: listar y crear.
 *
 *   GET  /api/v1/tasks?projectId=&status=&assignedToId=&limit=&cursor=
 *   POST /api/v1/tasks
 *
 * `externalRef` hace el POST idempotente: si la integración reintenta la misma
 * ejecución, se devuelve la tarea que ya creó (con `duplicate: true`) en vez de
 * duplicarla. Mándalo siempre que tu origen tenga un identificador propio.
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  projectId: z.string().min(1, "projectId es requerido"),
  title: z.string().trim().min(1, "title es requerido").max(200),
  description: z.string().trim().min(1, "description es requerida"),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  category: z.string().trim().max(80).optional(),
  assignedToId: z.string().optional(),
  startDate: dateString.optional(),
  dueDate: dateString.optional(),
  estimatedHours: z.number().positive().max(1000).optional(),
  externalRef: z.string().trim().min(1).max(191).optional(),
  onBehalfOf: z.string().trim().min(1).optional(),
});

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const url = new URL(req.url);
  const { limit, cursor } = readPagination(req);

  const result = await listTasks(actor.user, {
    limit,
    cursor,
    projectId: url.searchParams.get("projectId") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    assignedToId: url.searchParams.get("assignedToId") ?? undefined,
  });

  return apiOk(result);
}

export async function POST(req: Request) {
  const actor = await requireActor(req, "write");
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });
  }

  const author = await resolveActingUser(actor, parsed.data.onBehalfOf);
  if (author instanceof NextResponse) return author;

  const result = await createTaskViaApi(author, {
    projectId: parsed.data.projectId,
    title: parsed.data.title,
    description: parsed.data.description,
    priority: parsed.data.priority,
    category: parsed.data.category ?? null,
    assignedToId: parsed.data.assignedToId ?? null,
    startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    estimatedHours: parsed.data.estimatedHours ?? null,
    externalRef: parsed.data.externalRef ?? null,
  });

  if (!result.ok) return apiError(result.error, result.status);
  return apiOk({ task: result.value, duplicate: result.duplicate ?? false }, result.duplicate ? 200 : 201);
}
