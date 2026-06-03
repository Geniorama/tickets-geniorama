import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TaskForm } from "@/components/projects/task-form";
import { TemplatePicker } from "@/components/tasks/template-picker";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva tarea" };

export default async function NewTaskGlobalPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { template: templateId } = await searchParams;

  const [projects, staffUsers, reviewerCandidates, templates] = await Promise.all([
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
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.taskTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const template = templateId
    ? await prisma.taskTemplate.findUnique({ where: { id: templateId } })
    : null;
  const prefill = template
    ? {
        title: template.title,
        description: template.description,
        priority: template.priority as string,
        category: template.category,
        estimatedHours: template.estimatedHours,
        checklist: template.checklist,
      }
    : undefined;

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
        <TemplatePicker templates={templates} selected={templateId} />
        <TaskForm
          key={templateId ?? "blank"}
          projects={projects}
          staffUsers={staffUsers}
          reviewerCandidates={reviewerCandidates}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
