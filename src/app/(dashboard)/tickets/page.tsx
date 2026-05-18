import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TicketList } from "@/components/tickets/ticket-list";
import { TicketFilters } from "@/components/tickets/ticket-filters";
import { TicketKanban } from "@/components/tickets/ticket-kanban";
import { ViewToggle } from "@/components/tickets/view-toggle";
import Link from "next/link";
import { Plus } from "lucide-react";
import { fromZonedTime } from "date-fns-tz";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { getPageSize } from "@/lib/pagination";
import { redirect } from "next/navigation";
import { FilterTags, type FilterTag } from "@/components/ui/filter-tags";

const TZ = "America/Bogota";

const TICKET_STATUS_LABELS: Record<string, string> = {
  POR_ASIGNAR: "Por asignar",
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  CERRADO: "Cerrado",
};

export const metadata = { title: "Tickets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getRequiredSession();
  const { id, role } = session.user;
  const params = await searchParams;
  const staff = isStaff(role);

  if (Object.keys(params).length === 0 && staff) {
    const sp = new URLSearchParams();
    sp.set("status", "ABIERTO,EN_PROGRESO");
    sp.set("assignedToId", id);
    redirect(`/tickets?${sp.toString()}`);
  }

  const view = staff && params.view === "kanban" ? "kanban" : "list";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const q = params.q?.trim() || undefined;

  // Para clientes: obtener todos los IDs de clientes de la misma empresa
  let companyClientIds: string[] = [id];
  if (!staff) {
    const currentUser = await prisma.user.findUnique({
      where: { id },
      select: {
        companies: {
          select: {
            users: { where: { role: "CLIENTE" }, select: { id: true } },
          },
        },
      },
    });
    if (currentUser) {
      const ids = [
        ...new Set(currentUser.companies.flatMap((c) => c.users.map((u) => u.id))),
      ];
      if (ids.length > 0) companyClientIds = ids;
    }
  }

  // Base where: clientes ven tickets que crearon ellos O donde el cliente asignado es de su misma empresa
  const baseWhere = staff
    ? {}
    : { OR: [{ createdById: id }, { clientId: { in: companyClientIds } }] };

  // Filtros de fecha — interpretados como hora local de Bogota (UTC-5)
  const dateFilters: Record<string, unknown> = {};
  if (params.createdFrom || params.createdTo) {
    dateFilters.createdAt = {
      ...(params.createdFrom ? { gte: fromZonedTime(`${params.createdFrom}T00:00:00`, TZ) } : {}),
      ...(params.createdTo ? { lte: fromZonedTime(`${params.createdTo}T23:59:59.999`, TZ) } : {}),
    };
  }
  if (params.updatedFrom || params.updatedTo) {
    dateFilters.updatedAt = {
      ...(params.updatedFrom ? { gte: fromZonedTime(`${params.updatedFrom}T00:00:00`, TZ) } : {}),
      ...(params.updatedTo ? { lte: fromZonedTime(`${params.updatedTo}T23:59:59.999`, TZ) } : {}),
    };
  }

  const statusValues      = params.status?.split(",").filter(Boolean) ?? [];
  const assignedToValues  = params.assignedToId?.split(",").filter(Boolean) ?? [];
  const createdByValues   = params.createdById?.split(",").filter(Boolean) ?? [];
  const companyValues     = params.companyId?.split(",").filter(Boolean) ?? [];

  const where = {
    ...baseWhere,
    ...dateFilters,
    ...(assignedToValues.length  ? { assignedToId: { in: assignedToValues } }                                     : {}),
    ...(createdByValues.length   ? { createdById:  { in: createdByValues } }                                      : {}),
    ...(companyValues.length     ? { createdBy: { companies: { some: { id: { in: companyValues } } } } }          : {}),
    ...(statusValues.length      ? { status: { in: statusValues as never[] } }                                    : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  const sortBy = params.sortBy ?? "dueDate";
  const sortDir = params.sortDir === "desc" ? "desc" : "asc";

  type SortDir = "asc" | "desc";
  const orderBy: Record<string, unknown>[] = (() => {
    const d = sortDir as SortDir;
    switch (sortBy) {
      case "title":      return [{ title: d }];
      case "status":     return [{ status: d }];
      case "priority":   return [{ priority: d }];
      case "createdBy":  return [{ createdBy: { name: d } }];
      case "assignedTo": return [{ assignedTo: { name: d } }];
      case "updatedAt":  return [{ updatedAt: d }];
      case "dueDate":    return [{ dueDate: d }, { priority: "desc" }];
      case "createdAt":  return [{ createdAt: d }];
      default:           return [{ dueDate: "asc" }, { priority: "desc" }];
    }
  })();

  const [tickets, totalTickets, collaborators, creators, companies] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { name: true, companies: { select: { name: true } } } },
        assignedTo: { select: { name: true } },
      },
      orderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.ticket.count({ where }),
    staff
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    staff
      ? prisma.user.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    staff
      ? prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  const filterTags: FilterTag[] = [];
  statusValues.forEach((v) =>
    filterTags.push({ key: "status", value: v, label: `Estado: ${TICKET_STATUS_LABELS[v] ?? v}` })
  );
  assignedToValues.forEach((v) => {
    const u = collaborators.find((c) => c.id === v);
    const name = u?.name ?? (v === id ? session.user.name ?? "Yo" : v);
    filterTags.push({ key: "assignedToId", value: v, label: `Asignado a: ${name}` });
  });
  createdByValues.forEach((v) => {
    const u = creators.find((c) => c.id === v);
    filterTags.push({ key: "createdById", value: v, label: `Creado por: ${u?.name ?? v}` });
  });
  companyValues.forEach((v) => {
    const c = companies.find((co) => co.id === v);
    filterTags.push({ key: "companyId", value: v, label: `Empresa: ${c?.name ?? v}` });
  });
  if (params.createdFrom) filterTags.push({ key: "createdFrom", value: params.createdFrom, label: `Creado desde: ${params.createdFrom}` });
  if (params.createdTo) filterTags.push({ key: "createdTo", value: params.createdTo, label: `Creado hasta: ${params.createdTo}` });
  if (params.updatedFrom) filterTags.push({ key: "updatedFrom", value: params.updatedFrom, label: `Actualizado desde: ${params.updatedFrom}` });
  if (params.updatedTo) filterTags.push({ key: "updatedTo", value: params.updatedTo, label: `Actualizado hasta: ${params.updatedTo}` });
  if (q) filterTags.push({ key: "q", value: q, label: `Búsqueda: ${q}` });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {staff && <ViewToggle current={view} />}
          <Link
            href="/tickets/new"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 sm:px-4 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo ticket</span>
            <span className="sm:hidden">Nuevo</span>
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
          <SearchInput placeholder="Buscar tickets..." />
        </Suspense>
      </div>

      {staff && (
        <TicketFilters
          collaborators={collaborators}
          creators={creators}
          companies={companies}
          current={Object.fromEntries(Object.entries(params).filter(([k]) => k !== "page"))}
        />
      )}

      <div style={{ marginBottom: "1rem" }}>
        <FilterTags tags={filterTags} />
      </div>

      {view === "kanban" ? (
        <TicketKanban tickets={tickets} />
      ) : (
        <TicketList tickets={tickets} role={role} sortBy={sortBy} sortDir={sortDir} />
      )}

      <Pagination
        totalItems={totalTickets}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/tickets"
      />
    </div>
  );
}
