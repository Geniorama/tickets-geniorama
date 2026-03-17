import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/projects/task-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva tarea — Geniorama Tickets" };

export default async function NewTaskGlobalPage() {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  const [projects, staffUsers] = await Promise.all([
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

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/tareas" />
      </div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--app-body-text)",
          marginBottom: "1.5rem",
        }}
      >
        Nueva tarea
      </h1>

      <div
        style={{
          maxWidth: "64rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <TaskForm projects={projects} staffUsers={staffUsers} />
      </div>
    </div>
  );
}
