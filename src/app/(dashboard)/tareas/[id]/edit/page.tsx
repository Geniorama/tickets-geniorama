import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/projects/task-form";
import { BackButton } from "@/components/ui/back-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, select: { title: true } });
  return { title: task ? `Editar: ${task.title}` : "Editar tarea" };
}

export default async function EditGlobalTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { id: taskId } = await params;

  const [task, projects, staffUsers] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { id: true, name: true } },
        attachments: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.project.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!task) notFound();

  if (task.projectId) {
    redirect(`/proyectos/${task.projectId}/tareas/${taskId}/edit`);
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/tareas/${taskId}`} />
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
        Tarea global (sin proyecto)
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
        <TaskForm projects={projects} staffUsers={staffUsers} task={task} existingAttachments={task.attachments} />
      </div>
    </div>
  );
}
