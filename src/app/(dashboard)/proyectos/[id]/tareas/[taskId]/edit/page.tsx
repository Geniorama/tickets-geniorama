import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/projects/task-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Editar tarea — Geniorama Tickets" };

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { id: projectId, taskId } = await params;

  const [task, staffUsers] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task || task.projectId !== projectId) notFound();

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/proyectos/${projectId}/tareas/${taskId}`} />
      </div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--app-body-text)",
          marginBottom: "0.25rem",
        }}
      >
        Editar tarea
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
        Proyecto: {task.project.name}
      </p>

      <div
        style={{
          maxWidth: "42rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <TaskForm projectId={projectId} staffUsers={staffUsers} task={task} />
      </div>
    </div>
  );
}
