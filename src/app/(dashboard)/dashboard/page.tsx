import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { getAccessibleApps } from "@/lib/access/can";
import { OPEN_STAGES } from "@/lib/crm/deals";
import { ModuleGrid, type ModuleSummary } from "@/components/layout/module-grid";
import { AttentionBar, type AttentionItem } from "@/components/dashboard/attention-bar";
import { AlertCard } from "@/components/dashboard/alert-card";
import type { AppKey, AccountStage } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Clock, CreditCard, Star } from "lucide-react";
import type { TaskStatus, Priority, ProjectStatus } from "@/generated/prisma";
import { formatDate } from "@/lib/format-date";
import { getEffectiveExpiresAt, daysUntilExpiry, PLAN_EXPIRY_WARNING_DAYS } from "@/lib/plans";
import { ticketCode } from "@/lib/ticket-code";

export const metadata = { title: "Dashboard" };

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
  // Extraer la fecha actual en Colombia (funciona en cualquier servidor, incluido Netlify UTC).
  const bogotaDateStr   = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now); // "2026-03-17"
  const [by, bm, bd]    = bogotaDateStr.split("-").map(Number);
  const today           = new Date(Date.UTC(by, bm - 1, bd));
  const tomorrow        = new Date(Date.UTC(by, bm - 1, bd + 1));
  const dayAfterTomorrow = new Date(Date.UTC(by, bm - 1, bd + 2));

  // ── Filters by role ────────────────────────────────────────────────────────
  const ticketWhere: Record<string, unknown> = {
    isDraft: false,
    ...(staff ? {} : { OR: [{ createdById: userId }, { clientId: userId }] }),
  };

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

  // Los borradores no aparecen en el dashboard hasta publicarse
  taskWhere.isDraft = false;

  // Los módulos concedidos deciden qué se ofrece en el inicio: hasta ahora
  // dependía solo del rol, así que no reflejaba los niveles de la Fase 1.
  const apps = await getAccessibleApps(session.user);

  // La cifra del CRM solo se consulta si el módulo está concedido: para casi
  // todos los usuarios estas dos consultas no llegan a hacerse.
  const [crmCounts, dealsAbiertas] = apps.includes("CRM")
    ? await Promise.all([
        prisma.company.groupBy({
          by: ["stage"],
          where: { isActive: true },
          _count: { _all: true },
        }),
        prisma.deal.count({ where: { stage: { in: OPEN_STAGES } } }),
      ])
    : [[], 0];
  const crmBy = (stage: AccountStage) =>
    crmCounts.find((c) => c.stage === stage)?._count._all ?? 0;
  const enSeguimiento = crmBy("LEAD") + crmBy("PROSPECTO");

  // ── Parallel queries ───────────────────────────────────────────────────────
  const [
    tickets,
    projects,
    tasks,
    recentTickets,
    recentTasks,
    upcomingTasksList,
    rawAlertPlans,
    favoriteProjects,
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
        prefix: true, number: true,
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
    // Plans with expiry (admin only) — filtrar en JS para soportar durationDays
    admin
      ? prisma.plan.findMany({
          where: {
            isActive: true,
            OR: [{ expiresAt: { not: null } }, { durationDays: { not: null } }],
          },
          select: {
            id: true, name: true, type: true, totalHours: true,
            durationDays: true, startedAt: true, expiresAt: true, isActive: true,
            company: { select: { name: true } },
          },
        })
      : Promise.resolve([] as { id: string; name: string; type: string; totalHours: number | null; durationDays: number | null; startedAt: Date; expiresAt: Date | null; isActive: boolean; company: { name: string } }[]),
    // Favorite projects del usuario
    prisma.project.findMany({
      where: { ...projectWhere, favorites: { some: { userId } } },
      select: {
        id: true, name: true, status: true,
        company: { select: { name: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
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

  // Planes: separar vencidos y próximos a vencer
  const expiredAlertPlans = rawAlertPlans.filter((p) => {
    const expiry = getEffectiveExpiresAt(p);
    return expiry !== null && expiry < now;
  });
  const expiringAlertPlans = rawAlertPlans
    .filter((p) => {
      const days = daysUntilExpiry(p);
      return days !== null && days > 0 && days <= PLAN_EXPIRY_WARNING_DAYS;
    })
    .sort((a, b) => (daysUntilExpiry(a) ?? 0) - (daysUntilExpiry(b) ?? 0));

  // Una cifra por módulo, para saber qué espera dentro antes de entrar. Se
  // prioriza lo que pide atención: si hay tareas vencidas, eso es lo que se ve.
  const moduleSummaries: Partial<Record<AppKey, ModuleSummary>> = {
    TICKETS: ticketStats.abiertos + ticketStats.progreso > 0
      ? { value: ticketStats.abiertos + ticketStats.progreso, label: "sin cerrar" }
      : { value: ticketStats.total, label: "en total" },
    PROYECTOS: taskStats.vencidas > 0
      ? { value: taskStats.vencidas, label: taskStats.vencidas === 1 ? "tarea vencida" : "tareas vencidas", alert: true }
      : { value: projectStats.activos, label: projectStats.activos === 1 ? "proyecto activo" : "proyectos activos" },
    ...(apps.includes("CRM")
      ? {
          CRM: dealsAbiertas > 0
            ? { value: dealsAbiertas, label: dealsAbiertas === 1 ? "oportunidad abierta" : "oportunidades abiertas" }
            : enSeguimiento > 0
              ? { value: enSeguimiento, label: "en seguimiento" }
              : { value: crmBy("CLIENTE"), label: crmBy("CLIENTE") === 1 ? "cliente" : "clientes" },
        }
      : {}),
    ...(admin && (expiredAlertPlans.length > 0)
      ? { ADMIN: { value: expiredAlertPlans.length, label: expiredAlertPlans.length === 1 ? "plan vencido" : "planes vencidos", alert: true } as ModuleSummary }
      : {}),
  };

  // Lo que pide atención, ya resuelto: la banda solo pinta lo que no es cero.
  const atencion: AttentionItem[] = [
    { count: taskStats.vencidas,        one: "tarea vencida",  many: "tareas vencidas",  href: "/tareas", tone: "grave" },
    { count: taskStats.porVencer,       one: "tarea por vencer", many: "tareas por vencer", href: "/tareas", tone: "aviso" },
    ...(admin
      ? [
          { count: expiredAlertPlans.length,  one: "plan vencido",   many: "planes vencidos",   href: "/admin/plans", tone: "grave" as const },
          { count: expiringAlertPlans.length, one: "plan por vencer", many: "planes por vencer", href: "/admin/plans", tone: "aviso" as const },
        ]
      : []),
  ];

  return (
    <div>

      <div style={{ marginBottom: "1.25rem" }}>
        <h1 data-tour-id="page-title" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Hola, {name} 👋
        </h1>
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.2rem" }}>
          {now.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/*
        Lo urgente, una sola vez y arriba del todo. Estas cifras salían antes en
        un KPI, en una tarjeta de alerta y otra vez en el resumen de
        productividad; ahora se dicen aquí y lo de abajo es su detalle.
      */}
      <AttentionBar items={atencion} />

      <ModuleGrid apps={apps} summaries={moduleSummaries} />

      {/* ── Proyectos favoritos ── */}
      {favoriteProjects.length > 0 && (
        <div className="mb-4">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <Star style={{ width: "1rem", height: "1rem", color: "#f59e0b", fill: "#f59e0b" }} />
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              Proyectos favoritos
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {favoriteProjects.map((p) => (
              <Link
                key={p.id}
                href={`/proyectos/${p.id}`}
                style={{
                  display: "flex", flexDirection: "column", gap: "0.25rem",
                  padding: "0.75rem 0.875rem",
                  backgroundColor: "var(--app-card-bg)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "0.625rem",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.name}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {p.company?.name ?? "Sin empresa"} · {p._count.tasks} tareas
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

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
                  {t.number > 0 && (
                    <span style={{ display: "inline-block", marginRight: "0.375rem", padding: "0.05rem 0.35rem", borderRadius: "0.25rem", fontSize: "0.6875rem", fontWeight: 600, color: "var(--app-text-muted)", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", verticalAlign: "middle" }}>
                      {ticketCode(t.prefix, t.number)}
                    </span>
                  )}
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
                  href={t.project ? `/proyectos/${t.project.id}/tareas/${t.id}` : `/tareas/${t.id}`}
                  style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", padding: "0.75rem 0", borderBottom: "1px solid var(--app-border)", textDecoration: "none" }}
                >
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </p>
                    <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {t.project?.name ?? "Sin proyecto"}
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

      {/*
        Lo urgente en detalle. Antes eran cuatro tarjetas con el mismo marcado
        copiado, dentro de un grid que las estiraba todas a la misma altura:
        «Por vencer (1)» ocupaba una columna entera para una sola fila. Ahora
        las tareas van juntas en una tarjeta y los planes en otra, y el grid ya
        no estira nada.
      */}
      {(staff || admin) && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" style={{ alignItems: "start" }}>

          {/* El reparto de tareas no es una alerta: es el estado general. */}
          {taskStats.total > 0 && (
            <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem" }}>
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
                Estado de tareas
              </p>
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
              {/* El «Resumen de productividad» que había abajo repetía estas
                  mismas cifras. Se queda el enlace a donde de verdad se
                  analizan. */}
              {admin && (
                <Link href="/admin/estadisticas" style={{ display: "block", marginTop: "0.85rem", fontSize: "0.8125rem", color: "#fd1384", textDecoration: "none", fontWeight: 500 }}>
                  Ver productividad →
                </Link>
              )}
            </div>
          )}

          <AlertCard
            icon={Clock}
            sections={[
              {
                label: "Tareas vencidas",
                tone: "grave",
                total: taskStats.vencidas,
                moreHref: "/tareas",
                rows: overdueTasks.map((t) => ({
                  id: t.id,
                  title: t.title,
                  context: t.project?.name ?? "Sin proyecto",
                  meta: formatDate(t.dueDate!),
                  href: t.project ? `/proyectos/${t.project.id}/tareas/${t.id}` : `/tareas/${t.id}`,
                })),
              },
              {
                label: "Por vencer",
                tone: "aviso",
                total: taskStats.porVencer,
                moreHref: "/tareas",
                rows: upcomingTasksList.map((t) => {
                  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
                  const esHoy = t.dueDate ? t.dueDate.toISOString().slice(0, 10) < tomorrowStr : false;
                  return {
                    id: t.id,
                    title: t.title,
                    context: t.project?.name ?? "Sin proyecto",
                    meta: esHoy ? "Hoy" : "Mañana",
                    href: t.project ? `/proyectos/${t.project.id}/tareas/${t.id}` : `/tareas/${t.id}`,
                  };
                }),
              },
            ]}
          />

          {admin && (
            <AlertCard
              icon={CreditCard}
              sections={[
                {
                  label: "Planes vencidos",
                  tone: "grave",
                  total: expiredAlertPlans.length,
                  moreHref: "/admin/plans",
                  rows: expiredAlertPlans.slice(0, 4).map((p) => ({
                    id: p.id,
                    title: p.name,
                    context: p.company.name,
                    meta: `Venció ${formatDate(getEffectiveExpiresAt(p)!)}`,
                  })),
                },
                {
                  label: "Planes por vencer",
                  tone: "aviso",
                  total: expiringAlertPlans.length,
                  moreHref: "/admin/plans",
                  rows: expiringAlertPlans.slice(0, 4).map((p) => {
                    const dias = daysUntilExpiry(p)!;
                    return {
                      id: p.id,
                      title: p.name,
                      context: p.company.name,
                      meta: `${dias} día${dias !== 1 ? "s" : ""}`,
                    };
                  }),
                },
              ]}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

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
