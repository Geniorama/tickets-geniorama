import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  apiOk,
  readJson,
  readPagination,
  requireActor,
  resolveActingUser,
} from "@/lib/api/respond";
import { addCommentViaApi, listComments } from "@/lib/api/comments";

/**
 * Comentarios de una tarea.
 *
 *   GET  /api/v1/tasks/:id/comments
 *   POST /api/v1/tasks/:id/comments   { "body": "...", "onBehalfOf": "..." }
 */

export const dynamic = "force-dynamic";

const createSchema = z.object({
  body: z.string().trim().min(1, "body es requerido").max(10000),
  onBehalfOf: z.string().trim().min(1).optional(),
});

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const { limit, cursor } = readPagination(req);

  const result = await listComments(actor.user, "TASK", id, { limit, cursor });
  if (!result) return apiError("Tarea no encontrada", 404);

  return apiOk(result);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const result = await addCommentViaApi(author, "TASK", id, parsed.data.body);

  if (!result.ok) return apiError(result.error, result.status);
  return apiOk({ comment: result.value }, 201);
}
