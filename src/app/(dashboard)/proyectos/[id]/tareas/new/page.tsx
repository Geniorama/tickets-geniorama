import { notFound } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/projects/task-form";
import { BackButton } from "@/components/ui/back-button";
import { redirect } from "next/navigation";

export const metadata = { title: "Nueva tarea — Geniorama Tickets" };

export default async function NewTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) redirect("/proyectos");

  const { id: projectId } = await params;

  const [project, staffUsers] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!project) notFound();

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/proyectos/${projectId}`} />
      </div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--app-body-text)",
          marginBottom: "0.25rem",
        }}
      >
        Nueva tarea
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
        Proyecto: {project.name}
      </p>

      <div
        style={{
          maxWidth: "64rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <TaskForm projectId={projectId} staffUsers={staffUsers} />
      </div>
    </div>
  );
}
