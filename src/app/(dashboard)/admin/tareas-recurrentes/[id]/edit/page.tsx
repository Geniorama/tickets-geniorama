import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/ui/back-button";
import { RecurringTaskForm } from "@/components/admin/recurring-task-form";
import { parseDaysOfWeek } from "@/lib/recurrence";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = await prisma.recurringTaskTemplate.findUnique({ where: { id }, select: { title: true } });
  return { title: tpl ? `Editar: ${tpl.title}` : "Editar tarea recurrente" };
}

export default async function EditRecurringTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [tpl, projects, staffUsers, taskTemplates] = await Promise.all([
    prisma.recurringTaskTemplate.findUnique({ where: { id } }),
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
    prisma.taskTemplate.findMany({
      orderBy: { name: "asc" },
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

  if (!tpl) notFound();

  const initial = {
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    priority: tpl.priority,
    category: tpl.category,
    estimatedHours: tpl.estimatedHours,
    checklist: tpl.checklist,
    projectId: tpl.projectId,
    assignedToId: tpl.assignedToId,
    frequency: tpl.frequency,
    interval: tpl.interval,
    daysOfWeek: parseDaysOfWeek(tpl.daysOfWeek),
    dayOfMonth: tpl.dayOfMonth,
    startDate: tpl.startDate.toISOString().slice(0, 10),
    endDate: tpl.endDate ? tpl.endDate.toISOString().slice(0, 10) : null,
    dueDateOffsetDays: tpl.dueDateOffsetDays,
    isActive: tpl.isActive,
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/admin/tareas-recurrentes" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
        Editar tarea recurrente
      </h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
        Próxima ejecución: {tpl.nextRunAt.toLocaleString("es-CO")} ·{" "}
        {tpl.lastRunAt ? `Última: ${tpl.lastRunAt.toLocaleString("es-CO")}` : "Nunca ejecutada"}
      </p>

      <RecurringTaskForm initial={initial} projects={projects} staffUsers={staffUsers} taskTemplates={taskTemplates} />
    </div>
  );
}
