import { NextResponse } from "next/server";
import { apiOk, readPagination, requireActor } from "@/lib/api/respond";
import { listProjects } from "@/lib/api/tasks";

/**
 * Proyectos visibles para la llave.
 *
 *   GET /api/v1/projects?limit=&cursor=
 *
 * Solo lectura: crear proyectos sigue siendo una decisión que se toma dentro de
 * la plataforma, con su empresa, su responsable y sus miembros. Una integración
 * los necesita para saber dónde poner una tarea, no para inventarlos.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await requireActor(req, "read");
  if (actor instanceof NextResponse) return actor;

  const { limit, cursor } = readPagination(req);
  const result = await listProjects(actor.user, { limit, cursor });

  return apiOk(result);
}
