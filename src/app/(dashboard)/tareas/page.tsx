import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/projects/task-list";
import { TaskFilters } from "@/components/projects/task-filters";
import type { TaskStatus, Priority } from "@/generated/prisma";

export const metadata = { title: "Tareas — Geniorama Tickets" };

export default async function TareasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  if (!staff && !admin) redirect("/dashboard");

  const params = await searchParams;

  const statusFilter  = params.status     as TaskStatus | undefined;
  const priorityFilter = params.priority  as Priority   | undefined;
  const projectFilter = params.projectId  as string     | undefined;
  const assigneeFilter = params.assignedToId as string  | undefined;

  // Filtro base por rol
  let roleWhere: Record<string, unknown> = {};
  if (admin) {
    roleWhere = {};
  } else if (staff) {
    roleWhere = {
      OR: [
        { assignedToId: userId },
        { project: { managerId: userId } },
      ],
    };
  } else {
    // Clientes ven tareas de proyectos de sus empresas
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    roleWhere = { project: { companyId: { in: companyIds } } };
  }

  const where = {
    ...roleWhere,
    ...(statusFilter   ? { status: statusFilter }            : {}),
    ...(priorityFilter ? { priority: priorityFilter }        : {}),
    ...(projectFilter  ? { projectId: projectFilter }        : {}),
    ...(assigneeFilter ? { assignedToId: assigneeFilter }    : {}),
  };

  // Proyectos disponibles para el filtro (misma lógica de rol)
  let projectsWhere: Record<string, unknown> = {};
  if (!admin && staff) {
    projectsWhere = {
      OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }],
    };
  } else if (!staff) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    projectsWhere = { companyId: { in: companyIds } };
  }

  const [tasks, projects, staffUsers] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { name: true } },
        createdBy:  { select: { name: true } },
        project:    { select: { id: true, name: true } },
        _count:     { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.project.findMany({
      where: projectsWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    admin || staff
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "1.5rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Tareas
        </h1>
        <TaskFilters
          projects={projects}
          staff={staffUsers}
          showAssignee={admin || staff}
        />
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {tasks.length} {tasks.length === 1 ? "tarea" : "tareas"}
      </p>

      <TaskList tasks={tasks} />
    </div>
  );
}
