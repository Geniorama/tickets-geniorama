import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Ticket, FolderKanban, ListTodo, Users,
  AlertTriangle, Clock, CalendarClock, CheckCircle2, TrendingUp,
} from "lucide-react";
import type { TaskStatus, Priority, ProjectStatus } from "@/generated/prisma";
import { formatDate } from "@/lib/format-date";

export const metadata = { title: "Dashboard — Geniorama Tickets" };

// ── helpers ──────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

const TICKET_STATUS_LABEL: Record<string, string> = {
  ABIERTO:     "Abierto",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  CERRADO:     "Cerrado",
};

const TICKET_STATUS_COLOR: Record<string, string> = {
  ABIERTO:     "#64748b",
  EN_PROGRESO: "#3b82f6",
  EN_REVISION: "#8b5cf6",
  CERRADO:     "#22c55e",
};

const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  PENDIENTE:   "#64748b",
  EN_PROGRESO: "#3b82f6",
  EN_REVISION: "#8b5cf6",
  COMPLETADO:  "#22c55e",
};

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  PENDIENTE:   "Pendiente",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  COMPLETADO:  "Completado",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  BAJA:   "#64748b",
  MEDIA:  "#f59e0b",
  ALTA:   "#f97316",
  CRITICA:"#dc2626",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  BAJA:   "Baja",
  MEDIA:  "Media",
  ALTA:   "Alta",
  CRITICA:"Crítica",
};

const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANIFICACION: "Planificación",
  EN_DESARROLLO: "En desarrollo",
  EN_REVISION:   "En revisión",
  COMPLETADO:    "Completado",
  PAUSADO:       "Pausado",
};

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getRequiredSession();
  const { id: userId, role, name } = session.user;
  const admin = isAdmin(role);
  const staff = isStaff(role);
  const now             = new Date();
  // Usar fecha LOCAL (no UTC) para que "hoy" sea el día que el usuario experimenta,
  // pero construir en UTC midnight para coincidir con cómo Prisma almacena los dates.
  const today           = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const tomorrow        = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const dayAfterTomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 2));

  // ── Filters by role ────────────────────────────────────────────────────────
  const ticketWhere  = staff ? {} : { OR: [{ createdById: userId }, { clientId: userId }] };

  let projectWhere: Record<string, unknown> = {};
  let taskWhere:    Record<string, unknown> = {};

  if (admin) {
    projectWhere = {};
    taskWhere    = {};
  } else if (staff) {
    projectWhere = { OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }] };
    taskWhere    = { OR: [{ assignedToId: userId }, { project: { managerId: userId } }] };
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    projectWhere = { companyId: { in: companyIds } };
    taskWhere    = { project: { companyId: { in: companyIds } } };
  }

  // ── Parallel queries ───────────────────────────────────────────────────────
  const [
    tickets,
    projects,
    tasks,
    recentTickets,
    recentTasks,
    upcomingTasksList,
    userCount,
  ] = await Promise.all([
    // Ticket counts
    prisma.ticket.findMany({ where: ticketWhere, select: { status: true } }),
    // Projects
    prisma.project.findMany({ where: projectWhere, select: { id: true, name: true, status: true }, orderBy: { createdAt: "desc" } }),
    // Task counts + overdue
    prisma.task.findMany({ where: taskWhere, select: { status: true, dueDate: true, priority: true } }),
    // Recent tickets
    prisma.ticket.findMany({
      where: ticketWhere,
      select: {
        id: true, title: true, status: true, priority: true, createdAt: true,
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    // Recent tasks (staff/admin only)
    staff || admin
      ? prisma.task.findMany({
          where: taskWhere,
          select: { id: true, title: true, status: true, priority: true, dueDate: true, project: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
          take: 6,
        })
      : Promise.resolve([] as { id: string; title: string; status: string; priority: string; dueDate: Date | null; project: { id: string; name: string } }[]),
    // Tasks due today or tomorrow (staff/admin only)
    staff || admin
      ? prisma.task.findMany({
          where: { ...taskWhere, dueDate: { gte: today, lt: dayAfterTomorrow }, status: { notIn: ["COMPLETADO", "EN_REVISION"] } },
          select: { id: true, title: true, status: true, dueDate: true, project: { select: { id: true, name: true } } },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : Promise.resolve([] as { id: string; title: string; status: string; dueDate: Date | null; project: { id: string; name: string } }[]),
    // User count (admin only)
    admin
      ? prisma.user.count({ where: { isActive: true } })
      : Promise.resolve(null),
  ]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const ticketStats = {
    total:     tickets.length,
    abiertos:  tickets.filter((t) => t.status === "ABIERTO").length,
    progreso:  tickets.filter((t) => t.status === "EN_PROGRESO").length,
    revision:  tickets.filter((t) => t.status === "EN_REVISION").length,
    cerrados:  tickets.filter((t) => t.status === "CERRADO").length,
  };

  const projectStats = {
    total:    projects.length,
    activos:  projects.filter((p) => !["COMPLETADO", "PAUSADO"].includes(p.status)).length,
    completados: projects.filter((p) => p.status === "COMPLETADO").length,
    pausados: projects.filter((p) => p.status === "PAUSADO").length,
  };

  const taskStats = {
    total:     tasks.length,
    completadas: tasks.filter((t) => t.status === "COMPLETADO").length,
    activas:   tasks.filter((t) => t.status !== "COMPLETADO").length,
    enRevision: tasks.filter((t) => t.status === "EN_REVISION").length,
    porVencer:  tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < dayAfterTomorrow && t.status !== "COMPLETADO" && t.status !== "EN_REVISION").length,
    vencidas:  tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== "COMPLETADO" && t.status !== "EN_REVISION").length,
    criticas:  tasks.filter((t) => (t.priority === "CRITICA" || t.priority === "ALTA") && t.status !== "COMPLETADO").length,
  };

  const taskRate = pct(taskStats.completadas, taskStats.total);

  const overdueTasks = recentTasks
    .filter((t) => t.dueDate && new Date(t.dueDate) < today && t.status !== "COMPLETADO" && t.status !== "EN_REVISION")
    .slice(0, 4);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1400px" }}>

      {/* Welcome */}
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Hola, {name} 👋
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
          {now.toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ── KPI row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <KpiCard
          icon={Ticket}
          label="Tickets"
          value={ticketStats.total}
          href="/tickets"
          accent="#3b82f6"
          sub={[
            { label: "Abiertos",    value: ticketStats.abiertos,  color: "#64748b" },
            { label: "En progreso", value: ticketStats.progreso,   color: "#3b82f6" },
            { label: "En revisión", value: ticketStats.revision,   color: "#8b5cf6" },
            { label: "Cerrados",    value: ticketStats.cerrados,   color: "#22c55e" },
          ]}
        />
        <KpiCard
          icon={FolderKanban}
          label="Proyectos"
          value={projectStats.total}
          href="/proyectos"
          accent="#8b5cf6"
          sub={[
            { label: "Activos",     value: projectStats.activos,     color: "#3b82f6" },
            { label: "Completados", value: projectStats.completados,  color: "#22c55e" },
            { label: "Pausados",    value: projectStats.pausados,     color: "#f59e0b" },
          ]}
        />
        {(staff || admin) && (
          <KpiCard
            icon={ListTodo}
            label="Tareas"
            value={taskStats.total}
            href="/tareas"
            accent="#22c55e"
            sub={[
              { label: "Activas",     value: taskStats.activas,      color: "#3b82f6" },
              { label: "En revisión", value: taskStats.enRevision,   color: "#8b5cf6" },
              { label: "Por vencer",  value: taskStats.porVencer,    color: taskStats.porVencer > 0 ? "#f59e0b" : "var(--app-text-muted)" },
              { label: "Vencidas",    value: taskStats.vencidas,     color: taskStats.vencidas > 0 ? "#dc2626" : "var(--app-text-muted)" },
            ]}
          />
        )}
        {admin && (
          <KpiCard
            icon={Users}
            label="Usuarios activos"
            value={userCount ?? 0}
            href="/admin/users"
            accent="#fd1384"
            sub={[
              { label: "Tasa de tareas", value: `${taskRate}%`, color: taskRate >= 75 ? "#16a34a" : taskRate >= 40 ? "#b45309" : "#dc2626" },
              { label: "Tareas críticas", value: taskStats.criticas, color: taskStats.criticas > 0 ? "#f97316" : "var(--app-text-muted)" },
            ]}
          />
        )}
      </div>

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>

        {/* Recent tickets */}
        <Section
          title="Tickets recientes"
          href="/tickets"
          count={ticketStats.total}
          empty={recentTickets.length === 0}
          emptyText="No hay tickets."
        >
          {recentTickets.map((t) => (
            <Link
              key={t.id}
              href={`/tickets/${t.id}`}
              style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid var(--app-border)", textDecoration: "none" }}
            >
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t.title}
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                  {t.assignedTo?.name ?? "Sin asignar"} · {formatDate(t.createdAt)}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
                <Badge label={TICKET_STATUS_LABEL[t.status] ?? t.status} color={TICKET_STATUS_COLOR[t.status] ?? "#64748b"} />
                <Badge label={PRIORITY_LABEL[t.priority as Priority]} color={PRIORITY_COLOR[t.priority as Priority]} />
              </div>
            </Link>
          ))}
        </Section>

        {/* Recent tasks (staff/admin) or project list (client) */}
        {(staff || admin) ? (
          <Section
            title="Tareas recientes"
            href="/tareas"
            count={taskStats.total}
            empty={recentTasks.length === 0}
            emptyText="No hay tareas asignadas."
          >
            {recentTasks.map((t) => {
              const isOverdue = t.dueDate && new Date(t.dueDate) < today && t.status !== "COMPLETADO" && t.status !== "EN_REVISION";
              return (
                <Link
                  key={t.id}
                  href={`/proyectos/${t.project.id}/tareas/${t.id}`}
                  style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid var(--app-border)", textDecoration: "none" }}
                >
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {t.project.name}
                      {t.dueDate && (
                        <span style={{ color: isOverdue ? "#dc2626" : "inherit" }}>
                          {" · "}Vence {formatDate(t.dueDate)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
                    <Badge label={TASK_STATUS_LABEL[t.status as TaskStatus]} color={TASK_STATUS_COLOR[t.status as TaskStatus]} />
                    <Badge label={PRIORITY_LABEL[t.priority as Priority]} color={PRIORITY_COLOR[t.priority as Priority]} />
                  </div>
                </Link>
              );
            })}
          </Section>
        ) : (
          <Section
            title="Mis proyectos"
            href="/proyectos"
            count={projectStats.total}
            empty={projects.length === 0}
            emptyText="No hay proyectos vinculados."
          >
            {projects.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                href={`/proyectos/${p.id}`}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid var(--app-border)", textDecoration: "none", gap: "0.75rem" }}
              >
                <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <Badge label={PROJECT_STATUS_LABEL[p.status as ProjectStatus]} color="#8b5cf6" />
              </Link>
            ))}
          </Section>
        )}
      </div>

      {/* ── Bottom row — solo staff/admin ── */}
      {(staff || admin) && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>

        {/* Task breakdown */}
        {taskStats.total > 0 && (
          <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
              Estado de tareas
            </p>
            {/* Stacked bar */}
            <div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", gap: "2px", marginBottom: "1rem" }}>
              {(["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"] as TaskStatus[]).map((s) => {
                const count = tasks.filter((t) => t.status === s).length;
                return count > 0 ? (
                  <div key={s} title={`${TASK_STATUS_LABEL[s]}: ${count}`} style={{ flex: count, backgroundColor: TASK_STATUS_COLOR[s] }} />
                ) : null;
              })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {(["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"] as TaskStatus[]).map((s) => {
                const count = tasks.filter((t) => t.status === s).length;
                const w = pct(count, taskStats.total);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", width: "7rem", flexShrink: 0 }}>{TASK_STATUS_LABEL[s]}</span>
                    <div style={{ flex: 1, height: "6px", borderRadius: "9999px", backgroundColor: "var(--app-border)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${w}%`, backgroundColor: TASK_STATUS_COLOR[s], borderRadius: "9999px" }} />
                    </div>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)", minWidth: "1.5rem", textAlign: "right" }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--app-border)" }}>
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>Tasa de completado</span>
              <span style={{ fontSize: "1rem", fontWeight: 700, color: taskRate >= 75 ? "#16a34a" : taskRate >= 40 ? "#b45309" : "#dc2626" }}>{taskRate}%</span>
            </div>
          </div>
        )}

        {/* Overdue tasks alert */}
        {overdueTasks.length > 0 && (
          <div style={{ backgroundColor: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#dc2626", flexShrink: 0 }} />
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Tareas vencidas ({taskStats.vencidas})
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {overdueTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/proyectos/${t.project.id}/tareas/${t.id}`}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}
                >
                  <div style={{ overflow: "hidden" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{t.project.name}</p>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#dc2626", whiteSpace: "nowrap", flexShrink: 0 }}>
                    <Clock style={{ width: "0.75rem", height: "0.75rem", display: "inline", verticalAlign: "middle", marginRight: "0.2rem" }} />
                    {formatDate(t.dueDate!)}
                  </span>
                </Link>
              ))}
            </div>
            {taskStats.vencidas > overdueTasks.length && (
              <Link href="/tareas" style={{ display: "block", marginTop: "0.75rem", fontSize: "0.8125rem", color: "#dc2626", textDecoration: "none", fontWeight: 500 }}>
                Ver {taskStats.vencidas - overdueTasks.length} más →
              </Link>
            )}
          </div>
        )}

        {/* Upcoming tasks */}
        {upcomingTasksList.length > 0 && (
          <div style={{ backgroundColor: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "0.75rem", padding: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <CalendarClock style={{ width: "1rem", height: "1rem", color: "#d97706", flexShrink: 0 }} />
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#d97706", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Por vencer ({taskStats.porVencer})
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {upcomingTasksList.map((t) => {
                const tomorrowStr = tomorrow.toISOString().slice(0, 10);
                const isToday = t.dueDate && t.dueDate.toISOString().slice(0, 10) < tomorrowStr;
                return (
                  <Link
                    key={t.id}
                    href={`/proyectos/${t.project.id}/tareas/${t.id}`}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}
                  >
                    <div style={{ overflow: "hidden" }}>
                      <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{t.project.name}</p>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: isToday ? "#dc2626" : "#d97706", whiteSpace: "nowrap", flexShrink: 0 }}>
                      <Clock style={{ width: "0.75rem", height: "0.75rem", display: "inline", verticalAlign: "middle", marginRight: "0.2rem" }} />
                      {isToday ? "Hoy" : "Mañana"}
                    </span>
                  </Link>
                );
              })}
            </div>
            {taskStats.porVencer > upcomingTasksList.length && (
              <Link href="/tareas" style={{ display: "block", marginTop: "0.75rem", fontSize: "0.8125rem", color: "#d97706", textDecoration: "none", fontWeight: 500 }}>
                Ver {taskStats.porVencer - upcomingTasksList.length} más →
              </Link>
            )}
          </div>
        )}
      </div>}

      {/* ── Admin: quick productivity ── */}
      {admin && (
        <div style={{ marginTop: "1rem", backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Resumen de productividad
            </p>
            <Link href="/admin/estadisticas" style={{ fontSize: "0.8125rem", color: "#fd1384", textDecoration: "none", fontWeight: 500 }}>
              Ver detalle →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem" }}>
            {[
              { icon: CheckCircle2, label: "Tareas completadas", value: taskStats.completadas, color: "#22c55e" },
              { icon: AlertTriangle, label: "Tareas vencidas",   value: taskStats.vencidas,   color: taskStats.vencidas > 0 ? "#dc2626" : "var(--app-text-muted)" },
              { icon: TrendingUp,   label: "Tasa global",        value: `${taskRate}%`,        color: taskRate >= 75 ? "#16a34a" : taskRate >= 40 ? "#b45309" : "#dc2626" },
              { icon: FolderKanban, label: "Proyectos activos",  value: projectStats.activos,  color: "#8b5cf6" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.875rem", borderRadius: "0.5rem", backgroundColor: "var(--app-content-bg)" }}>
                <Icon style={{ width: "1.25rem", height: "1.25rem", color, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: "1.125rem", fontWeight: 700, color }}>{value}</p>
                  <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, href, accent, sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  href: string;
  accent: string;
  sub: { label: string; value: number | string; color: string }[];
}) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          transition: "border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <div style={{ width: "2.25rem", height: "2.25rem", borderRadius: "0.5rem", backgroundColor: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon style={{ width: "1.125rem", height: "1.125rem", color: accent }} />
          </div>
          <span style={{ fontSize: "2rem", fontWeight: 700, color: "var(--app-body-text)" }}>{value}</span>
        </div>
        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.625rem" }}>{label}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {sub.map((s) => (
            <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{s.label}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Link>
  );
}

function Section({
  title, href, count, empty, emptyText, children,
}: {
  title: string;
  href: string;
  count: number;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {title}
        </p>
        <Link href={href} style={{ fontSize: "0.8125rem", color: "#fd1384", textDecoration: "none", fontWeight: 500 }}>
          Ver todos ({count}) →
        </Link>
      </div>
      {empty ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", paddingTop: "1rem" }}>{emptyText}</p>
      ) : (
        <div style={{ marginTop: "0.25rem" }}>{children}</div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: "0.6875rem",
      fontWeight: 600,
      padding: "0.15rem 0.45rem",
      borderRadius: "9999px",
      backgroundColor: `${color}1a`,
      color,
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}
