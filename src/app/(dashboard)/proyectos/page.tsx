import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ProjectList } from "@/components/projects/project-list";
import { ProjectFilters } from "@/components/projects/project-filters";
import { ProjectViewToggle } from "@/components/projects/project-view-toggle";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ProjectStatus } from "@/generated/prisma";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { getPageSize } from "@/lib/pagination";

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
  const statusValues  = params.status?.split(",").filter(Boolean)    as ProjectStatus[] | undefined;
  const companyValues = params.companyId?.split(",").filter(Boolean) as string[]        | undefined;
  const managerValues = params.managerId?.split(",").filter(Boolean) as string[]        | undefined;
  const dueDateFrom     = params.dueDateFrom as string | undefined;
  const dueDateTo       = params.dueDateTo   as string | undefined;

  // Filtros aplicables a cualquier rol
  const extraFilters = {
    ...(statusValues?.length  ? { status:    { in: statusValues } }  : {}),
    ...(companyValues?.length ? { companyId: { in: companyValues } } : {}),
    ...(managerValues?.length ? { managerId: { in: managerValues } } : {}),
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
  const pageSize = getPageSize(params.pageSize);
  const view = params.view === "grid" ? "grid" : "list";

  const projectInclude = {
    company: { select: { name: true } },
    manager: { select: { name: true } },
    createdBy: { select: { name: true } },
    _count: { select: { tasks: true } },
  } as const;

  // IDs favoritos del usuario, dentro del scope visible
  const favoriteRows = await prisma.projectFavorite.findMany({
    where: { userId, project: where },
    select: { projectId: true },
  });
  const favoriteIdSet = new Set(favoriteRows.map((f) => f.projectId));
  const favoriteIds = [...favoriteIdSet];

  // Total para paginación
  const totalProjects = await prisma.project.count({ where });

  // Página: primero los favoritos en orden, luego el resto
  const offset = (page - 1) * pageSize;
  const favCount = favoriteIds.length;
  // notIn no acepta arrays vacíos en algunos drivers — usamos sentinel
  const notInIds = favoriteIds.length ? favoriteIds : ["__none__"];

  const favSliceP =
    offset < favCount
      ? prisma.project.findMany({
          where: { ...where, id: { in: favoriteIds } },
          include: projectInclude,
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip: offset,
        })
      : Promise.resolve([]);

  const nonFavSliceP =
    offset < favCount
      ? prisma.project.findMany({
          where: { ...where, id: { notIn: notInIds } },
          include: projectInclude,
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip: 0,
        })
      : prisma.project.findMany({
          where: { ...where, id: { notIn: notInIds } },
          include: projectInclude,
          orderBy: { createdAt: "desc" },
          take: pageSize,
          skip: offset - favCount,
        });

  const [favSlice, nonFavSlice] = await Promise.all([favSliceP, nonFavSliceP]);
  const projects = [...favSlice, ...nonFavSlice].slice(0, pageSize);

  const [companies, managers] = await Promise.all([
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
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Proyectos
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <ProjectViewToggle current={view} />
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
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-5">
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
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

      <ProjectList projects={projects} view={view} favoriteIds={favoriteIdSet} />

      <Pagination
        totalItems={totalProjects}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/proyectos"
      />
    </div>
  );
}
