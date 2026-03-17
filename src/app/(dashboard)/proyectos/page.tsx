import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectFilters } from "@/components/projects/project-filters";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";

const PAGE_SIZE = 20;

export const metadata = { title: "Proyectos — Geniorama Tickets" };

export default async function ProyectosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const params = await searchParams;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  const q = params.q?.trim() || undefined;
  const statusFilter    = params.status     as ProjectStatus | undefined;
  const companyFilter   = params.companyId  as string | undefined;
  const managerFilter   = params.managerId  as string | undefined;
  const dueDateFrom     = params.dueDateFrom as string | undefined;
  const dueDateTo       = params.dueDateTo   as string | undefined;

  // Filtros aplicables a cualquier rol
  const extraFilters = {
    ...(statusFilter  ? { status: statusFilter }      : {}),
    ...(companyFilter ? { companyId: companyFilter }  : {}),
    ...(managerFilter ? { managerId: managerFilter }  : {}),
    ...(dueDateFrom || dueDateTo
      ? {
          dueDate: {
            ...(dueDateFrom ? { gte: new Date(dueDateFrom) } : {}),
            ...(dueDateTo   ? { lte: new Date(dueDateTo + "T23:59:59") } : {}),
          },
        }
      : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  // Filtro base por rol
  let roleWhere: Record<string, unknown> = {};
  if (admin) {
    roleWhere = {};
  } else if (staff) {
    roleWhere = {
      OR: [
        // Proyectos públicos donde es manager o tiene tareas asignadas
        { isPrivate: false, OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }] },
        // Proyectos privados donde es miembro
        { isPrivate: true, members: { some: { userId } } },
      ],
    };
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    roleWhere = {
      OR: [
        // Proyectos públicos de su empresa
        { isPrivate: false, companyId: { in: companyIds } },
        // Proyectos privados donde es miembro explícito
        { isPrivate: true, members: { some: { userId } } },
      ],
    };
  }

  const where = { ...roleWhere, ...extraFilters };
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [projects, totalProjects, companies, managers] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        company: { select: { name: true } },
        manager: { select: { name: true } },
        createdBy: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.project.count({ where }),
    // Solo admins y staff ven el filtro de empresa
    admin || staff
      ? prisma.company.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    // Solo admins ven el filtro de encargado
    admin
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div style={{ padding: "1.5rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Proyectos
        </h1>

        {admin && (
          <Link
            href="/proyectos/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
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
            Nuevo proyecto
          </Link>
        )}
      </div>

      {/* Filters */}
      <div style={{ marginBottom: "1.25rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <Suspense fallback={<div style={{ height: "2.375rem", width: "220px" }} />}>
          <SearchInput placeholder="Buscar proyectos..." />
        </Suspense>
        <ProjectFilters
          companies={companies}
          managers={managers}
          showCompany={admin || staff}
          showManager={admin}
        />
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {totalProjects} {totalProjects === 1 ? "proyecto" : "proyectos"}
      </p>

      <ProjectList projects={projects} />

      <Pagination
        totalItems={totalProjects}
        currentPage={page}
        pageSize={PAGE_SIZE}
        params={params}
        basePath="/proyectos"
      />
    </div>
  );
}
