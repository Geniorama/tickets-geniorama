import { NextResponse } from "next/server";
import { apiError, apiOk, requireActor } from "@/lib/api/respond";
import { getProject } from "@/lib/api/tasks";

/** GET /api/v1/projects/:id */

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { id } = await params;
  const project = await getProject(actor.user, id);
  if (!project) return apiError("Proyecto no encontrado", 404);

  return apiOk({ project });
}
