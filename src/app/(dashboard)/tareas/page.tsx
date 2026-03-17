import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TaskList } from "@/components/projects/task-list";
import { TaskFilters } from "@/components/projects/task-filters";
import type { TaskStatus, Priority } from "@/generated/prisma";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import Link from "next/link";
import { Plus } from "lucide-react";

const PAGE_SIZE = 25;

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

  const statusFilter   = params.status       as TaskStatus | undefined;
  const priorityFilter = params.priority    as Priority   | undefined;
  const projectFilter  = params.projectId   as string     | undefined;
  const assigneeFilter = params.assignedToId as string    | undefined;
  const q              = params.q?.trim()   || undefined;

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const sortBy  = params.sortBy  ?? "createdAt";
  const sortDir = (params.sortDir === "asc" ? "asc" : "desc") as "asc" | "desc";

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
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}),
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

  const orderBy: Record<string, unknown> = (() => {
    const d = sortDir;
    switch (sortBy) {
      case "title":      return { title: d };
      case "project":    return { project: { name: d } };
      case "status":     return { status: d };
      case "priority":   return { priority: d };
      case "assignedTo": return { assignedTo: { name: d } };
      case "startDate":  return { startDate: d };
      case "dueDate":    return { dueDate: d };
      default:           return { createdAt: d };
    }
  })();

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  const [tasks, totalTasks, projects, staffUsers] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { name: true } },
        createdBy:  { select: { name: true } },
        project:    { select: { id: true, name: true } },
        _count:     { select: { comments: true } },
      },
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.task.count({ where }),
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
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          {(admin || staff) && (
            <Link
              href="/tareas/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                backgroundColor: "#fd1384",
                color: "#ffffff",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Nueva tarea
            </Link>
          )}
          <Suspense fallback={<div style={{ height: "2.375rem", width: "220px" }} />}>
            <SearchInput placeholder="Buscar tareas..." />
          </Suspense>
          <TaskFilters
            projects={projects}
            staff={staffUsers}
            showAssignee={admin || staff}
          />
        </div>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {totalTasks} {totalTasks === 1 ? "tarea" : "tareas"}
      </p>

      <TaskList
        tasks={tasks}
        sortBy={sortBy}
        sortDir={sortDir}
        basePath="/tareas"
        paramsStr={paramsStr}
      />

      <Pagination
        totalItems={totalTasks}
        currentPage={page}
        pageSize={PAGE_SIZE}
        params={params}
        basePath="/tareas"
      />
    </div>
  );
}
