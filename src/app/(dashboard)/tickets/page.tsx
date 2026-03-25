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

const PAGE_SIZE = 25;

const TZ = "America/Bogota";

export const metadata = { title: "Tickets — Geniorama Tickets" };

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getRequiredSession();
  const { id, role } = session.user;
  const params = await searchParams;
  const staff = isStaff(role);
  const view = staff && params.view === "kanban" ? "kanban" : "list";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const q = params.q?.trim() || undefined;

  // Base where: clientes ven tickets que crearon ellos O donde son el cliente asignado
  const baseWhere = staff ? {} : { OR: [{ createdById: id }, { clientId: id }] };

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

  const where = {
    ...baseWhere,
    ...dateFilters,
    ...(params.assignedToId ? { assignedToId: params.assignedToId } : {}),
    ...(params.createdById ? { createdById: params.createdById } : {}),
    ...(params.companyId ? { createdBy: { companies: { some: { id: params.companyId } } } } : {}),
    ...(params.status ? { status: params.status as never } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }] } : {}),
  };

  const sortBy = params.sortBy ?? "createdAt";
  const sortDir = params.sortDir === "asc" ? "asc" : "desc";

  type SortDir = "asc" | "desc";
  const orderBy: Record<string, unknown> = (() => {
    const d = sortDir as SortDir;
    switch (sortBy) {
      case "title":      return { title: d };
      case "status":     return { status: d };
      case "priority":   return { priority: d };
      case "createdBy":  return { createdBy: { name: d } };
      case "assignedTo": return { assignedTo: { name: d } };
      case "updatedAt":  return { updatedAt: d };
      case "dueDate":    return { dueDate: d };
      default:           return { createdAt: d };
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
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
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

      {view === "kanban" ? (
        <TicketKanban tickets={tickets} />
      ) : (
        <TicketList tickets={tickets} role={role} sortBy={sortBy} sortDir={sortDir} />
      )}

      <Pagination
        totalItems={totalTickets}
        currentPage={page}
        pageSize={PAGE_SIZE}
        params={params}
        basePath="/tickets"
      />
    </div>
  );
}
