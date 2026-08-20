import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Webhook } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { getProjectHooks } from "@/actions/hook.actions";
import { HooksManager } from "@/components/integrations/hooks-manager";

/**
 * Hooks de un proyecto.
 *
 * Existen aparte de los de organización porque responden a otra necesidad: un
 * canal del equipo que solo sigue *este* proyecto, sin que el resto de la
 * plataforma le llegue encima. Y es la única forma de sacar eventos de un
 * proyecto privado, que nunca salen al alcance general.
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({ where: { id }, select: { name: true } });
  return { title: project ? `Hooks — ${project.name}` : "Hooks del proyecto" };
}

export default async function ProjectHooksPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCan("PROYECTOS", "gestionar");

  const { id: projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isPrivate: true },
  });
  if (!project) notFound();

  const hooks = await getProjectHooks(projectId);

  return (
    <div style={{ maxWidth: "48rem" }}>
      <Link
        href={`/proyectos/${projectId}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.8125rem",
          color: "var(--app-text-muted)",
          textDecoration: "none",
          marginBottom: "1rem",
        }}
      >
        <ArrowLeft style={{ width: "0.875rem", height: "0.875rem" }} />
        {project.name}
      </Link>

      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Webhook style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Hooks del proyecto
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
          Envían a un servicio externo lo que pasa <strong>solo en este proyecto</strong>: sus tareas,
          sus comentarios y sus propios cambios. Los tickets no llegan aquí — son soporte y no cuelgan
          de un proyecto.
          {project.isPrivate && (
            <>
              {" "}
              Este proyecto es <strong>privado</strong>, así que estos hooks son la única salida de sus
              eventos: los de organización no los reciben.
            </>
          )}
        </p>
      </div>

      <HooksManager hooks={hooks} scope="PROJECT" projectId={projectId} />
    </div>
  );
}
