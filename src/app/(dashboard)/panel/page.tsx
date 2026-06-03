import { requireRole } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LayoutList } from "lucide-react";
import { PanelTable } from "@/components/panel/panel-table";
import { PanelFilters } from "@/components/panel/panel-filters";
import { SearchInput } from "@/components/ui/search-input";
import { FilterTags, type FilterTag } from "@/components/ui/filter-tags";
import { Pagination } from "@/components/ui/pagination";
import { getPageSize } from "@/lib/pagination";
import { ticketCode } from "@/lib/ticket-code";
import { taskCode } from "@/lib/task-code";
import { sortPanelItems, type PanelItem } from "@/lib/panel";
import { Prisma } from "@/generated/prisma";

export const metadata = { title: "Panel" };

const PRIORITY_LABELS: Record<string, string> = {
  CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Media", BAJA: "Baja",
};

// Tope defensivo de filas combinadas antes de paginar en memoria.
const FETCH_CAP = 500;

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { id: userId, role } = session.user;
  const admin = isAdmin(role);

  const params = await searchParams;

  // Por defecto: colaborador ve lo asignado a él; admin ve todo.
  if (Object.keys(params).length === 0 && !admin) {
    const sp = new URLSearchParams();
    sp.set("assignedToId", userId);
    redirect(`/panel?${sp.toString()}`);
  }

  const kindValues     = params.kind?.split(",").filter(Boolean) ?? [];
  const priorityValues = params.priority?.split(",").filter(Boolean) ?? [];
  const assigneeValues = params.assignedToId?.split(",").filter(Boolean) ?? [];
  const q              = params.q?.trim() || undefined;
  const overdueOnly    = params.overdue === "1";
  const includeDone    = params.done === "1";

  const showTickets = kindValues.length === 0 || kindValues.includes("ticket");
  const showTasks   = kindValues.length === 0 || kindValues.includes("task");

  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const sortBy = params.sortBy;
  const sortDir = (params.sortDir === "desc" ? "desc" : "asc") as "asc" | "desc";

  const now = new Date();

  // Filtros comunes a tickets y tareas (estado/fecha se agregan aparte)
  const sharedAnd = <T extends { assignedToId?: unknown; priority?: unknown; OR?: unknown }>(): T[] => {
    const and: T[] = [];
    if (assigneeValues.length) and.push({ assignedToId: { in: assigneeValues } } as T);
    if (priorityValues.length) and.push({ priority: { in: priorityValues } } as T);
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      } as T);
    }
    return and;
  };

  // ── Ticket where ──
  const ticketAnd = sharedAnd<Prisma.TicketWhereInput>();
  if (overdueOnly) {
    ticketAnd.push({ dueDate: { lt: now } });
    ticketAnd.push({ status: { not: "CERRADO" } });
  } else if (!includeDone) {
    ticketAnd.push({ status: { not: "CERRADO" } });
  }
  const ticketWhere: Prisma.TicketWhereInput = ticketAnd.length ? { AND: ticketAnd } : {};

  // ── Task where (colaborador: solo asignadas a él o de proyectos que gestiona) ──
  const taskAnd = sharedAnd<Prisma.TaskWhereInput>();
  if (!admin) {
    taskAnd.push({ OR: [{ assignedToId: userId }, { project: { managerId: userId } }] });
  }
  if (overdueOnly) {
    taskAnd.push({ dueDate: { lt: now } });
    taskAnd.push({ status: { not: "COMPLETADO" } });
  } else if (!includeDone) {
    taskAnd.push({ status: { not: "COMPLETADO" } });
  }
  const taskWhere: Prisma.TaskWhereInput = taskAnd.length ? { AND: taskAnd } : {};

  const [tickets, tasks, staffUsers] = await Promise.all([
    showTickets
      ? prisma.ticket.findMany({
          where: ticketWhere,
          include: {
            assignedTo: { select: { name: true } },
            createdBy: { select: { companies: { select: { name: true } } } },
          },
          orderBy: { updatedAt: "desc" },
          take: FETCH_CAP,
        })
      : Promise.resolve([]),
    showTasks
      ? prisma.task.findMany({
          where: taskWhere,
          include: {
            assignedTo: { select: { name: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: FETCH_CAP,
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const ticketItems: PanelItem[] = tickets.map((t) => ({
    id: t.id,
    kind: "ticket",
    code: ticketCode(t.prefix, t.number),
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignedTo?.name ?? null,
    context: t.createdBy.companies[0]?.name ?? null,
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    href: `/tickets/${t.id}`,
  }));

  const taskItems: PanelItem[] = tasks.map((t) => ({
    id: t.id,
    kind: "task",
    code: taskCode(t.project?.name ?? "GLB", t.number),
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignedTo: t.assignedTo?.name ?? null,
    context: t.project?.name ?? "Sin proyecto",
    dueDate: t.dueDate,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    href: t.project ? `/proyectos/${t.project.id}/tareas/${t.id}` : `/tareas/${t.id}`,
  }));

  const all = sortPanelItems([...ticketItems, ...taskItems], sortBy, sortDir);
  const total = all.length;
  const pageItems = all.slice((page - 1) * pageSize, page * pageSize);

  // Tags de filtros activos
  const filterTags: FilterTag[] = [];
  kindValues.forEach((v) =>
    filterTags.push({ key: "kind", value: v, label: `Tipo: ${v === "ticket" ? "Tickets" : "Tareas"}` })
  );
  priorityValues.forEach((v) =>
    filterTags.push({ key: "priority", value: v, label: `Prioridad: ${PRIORITY_LABELS[v] ?? v}` })
  );
  assigneeValues.forEach((v) => {
    const u = staffUsers.find((s) => s.id === v);
    const name = u?.name ?? (v === userId ? session.user.name ?? "Yo" : v);
    filterTags.push({ key: "assignedToId", value: v, label: `Responsable: ${name}` });
  });
  if (overdueOnly) filterTags.push({ key: "overdue", value: "1", label: "Solo vencidos" });
  if (includeDone) filterTags.push({ key: "done", value: "1", label: "Incluye cerradas/completadas" });
  if (q) filterTags.push({ key: "q", value: q, label: `Búsqueda: ${q}` });

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <LayoutList style={{ width: "1.5rem", height: "1.5rem", color: "#fd1384" }} />
        <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Panel
        </h1>
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        Tickets y tareas en un solo lugar para filtrar y priorizar. Por defecto se ordenan por urgencia:
        vencidos primero, luego por prioridad.
      </p>

      <div className="flex flex-col gap-3 mb-5">
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
          <SearchInput placeholder="Buscar en tickets y tareas..." />
        </Suspense>
        <PanelFilters staff={staffUsers} />
        <FilterTags tags={filterTags} />
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {total} {total === 1 ? "elemento" : "elementos"}
        {total >= FETCH_CAP * (showTickets && showTasks ? 2 : 1) ? " (mostrando los más recientes)" : ""}
      </p>

      <PanelTable items={pageItems} sortBy={sortBy ?? ""} sortDir={sortDir} paramsStr={paramsStr} />

      <Pagination
        totalItems={total}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/panel"
      />
    </div>
  );
}
