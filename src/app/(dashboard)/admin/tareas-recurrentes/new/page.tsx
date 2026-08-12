import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/ui/back-button";
import { RecurringTaskForm } from "@/components/admin/recurring-task-form";
import { normalizeChecklistGroups } from "@/lib/checklist";

export const metadata = { title: "Nueva tarea recurrente" };

export default async function NewRecurringTaskPage() {
  await requireCan("PROYECTOS", "gestionar");

  const [projects, staffUsers, taskTemplates] = await Promise.all([
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
    prisma.template.findMany({ where: { entityType: "TASK" }, orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        priority: true,
        category: true,
        estimatedHours: true,
        checklist: true,
      },
    }),
  ]);

  const templateOptions = taskTemplates.map((t) => ({
    ...t,
    checklist: normalizeChecklistGroups(t.checklist),
  }));

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/admin/tareas-recurrentes" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Nueva tarea recurrente
      </h1>

      <RecurringTaskForm projects={projects} staffUsers={staffUsers} taskTemplates={templateOptions} />
    </div>
  );
}
