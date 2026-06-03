import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { ProjectStatus, TaskStatus, Priority } from "@/generated/prisma";
import { ProjectReportPicker } from "@/components/reportes/project-report-picker";
import { PrintButton } from "@/components/reportes/print-button";
import { formatDate } from "@/lib/format-date";

export const metadata = { title: "Reportes de proyectos" };

const TASK_STATUS_META: { key: TaskStatus; label: string; color: string }[] = [
  { key: "PENDIENTE",   label: "Pendiente",   color: "#64748b" },
  { key: "EN_PROGRESO", label: "En progreso", color: "#3b82f6" },
  { key: "EN_REVISION", label: "En revisión", color: "#8b5cf6" },
  { key: "COMPLETADO",  label: "Completado",  color: "#22c55e" },
];

const PRIORITY_META: { key: Priority; label: string; color: string }[] = [
  { key: "CRITICA", label: "Crítica", color: "#dc2626" },
  { key: "ALTA",    label: "Alta",    color: "#f97316" },
  { key: "MEDIA",   label: "Media",   color: "#f59e0b" },
  { key: "BAJA",    label: "Baja",    color: "#64748b" },
];

const PROJECT_STATUS_META: Record<ProjectStatus, { label: string; color: string; bg: string }> = {
  PLANIFICACION:  { label: "Planificación",  color: "#64748b", bg: "rgba(100,116,139,0.12)" },
  EN_DESARROLLO:  { label: "En desarrollo",  color: "#3b82f6", bg: "rgba(59,130,246,0.12)"  },
  EN_REVISION:    { label: "En revisión",    color: "#8b5cf6", bg: "rgba(139,92,246,0.12)"  },
  COMPLETADO:     { label: "Completado",     color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  PAUSADO:        { label: "Pausado",        color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
};

const TASK_STATUS_ORDER: TaskStatus[] = ["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"];

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: "6px", borderRadius: "9999px", backgroundColor: "var(--app-border)", overflow: "hidden", width: "100%", minWidth: "60px" }}>
      <div style={{ height: "100%", width: `${value}%`, backgroundColor: color, borderRadius: "9999px" }} />
    </div>
  );
}

function SegmentBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ height: "10px", borderRadius: "9999px", backgroundColor: "var(--app-border)" }} />;
  return (
    <div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", gap: "2px" }}>
      {segments.filter((s) => s.value > 0).map((seg) => (
        <div key={seg.label} title={`${seg.label}: ${seg.value}`} style={{ flex: seg.value, backgroundColor: seg.color }} />
      ))}
    </div>
  );
}

export default async function ProyectosReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const admin = isAdmin(role);
  const staff = isStaff(role);
  const now   = new Date();
  const { project: selectedProjectId } = await searchParams;

  // Role-based project filter
  let where: Record<string, unknown> = {};
  if (admin) {
    where = {};
  } else if (staff) {
    where = { OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }] };
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const ids = (user?.companies ?? []).map((c) => c.id);
    where = { companyId: { in: ids } };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      company: { select: { name: true } },
      manager: { select: { name: true } },
      tasks:   { select: { status: true, dueDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // ── Global KPIs ──────────────────────────────────────────────────────────────
  const totalProjects   = projects.length;
  const allTasks        = projects.flatMap((p) => p.tasks);
  const totalTasks      = allTasks.length;
  const completedTasks  = allTasks.filter((t) => t.status === "COMPLETADO").length;
  const overdueTasks    = allTasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "COMPLETADO").length;
  const completionRate  = pct(completedTasks, totalTasks);

  // ── Projects by status ───────────────────────────────────────────────────────
  const byStatus = Object.entries(PROJECT_STATUS_META).map(([key, meta]) => ({
    ...meta,
    key,
    count: projects.filter((p) => p.status === key).length,
  }));

  // ── Per-project rows ─────────────────────────────────────────────────────────
  const rows = projects.map((p) => {
    const total     = p.tasks.length;
    const completed = p.tasks.filter((t) => t.status === "COMPLETADO").length;
    const overdue   = p.tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "COMPLETADO").length;
    const rate      = pct(completed, total);
    const byTaskStatus = TASK_STATUS_ORDER.map((s) => ({
      status: s,
      count: p.tasks.filter((t) => t.status === s).length,
    }));
    return { ...p, total, completed, overdue, rate, byTaskStatus };
  });

  // ── Estadísticas del proyecto individual seleccionado ──────────────────────────
  const selectedProject = selectedProjectId
    ? await prisma.project.findFirst({
        where: { id: selectedProjectId, ...where },
        include: {
          company: { select: { name: true } },
          manager: { select: { name: true } },
          tasks: {
            select: {
              status: true,
              priority: true,
              dueDate: true,
              estimatedHours: true,
              assignedTo: { select: { id: true, name: true } },
            },
          },
        },
      })
    : null;

  const individual = selectedProject
    ? (() => {
        const tasks = selectedProject.tasks;
        const total = tasks.length;
        const completed = tasks.filter((t) => t.status === "COMPLETADO").length;
        const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "COMPLETADO").length;
        const estimated = tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
        const rate = pct(completed, total);

        const byStatus = TASK_STATUS_META.map((m) => ({ ...m, count: tasks.filter((t) => t.status === m.key).length }));
        const byPriority = PRIORITY_META.map((m) => ({ ...m, count: tasks.filter((t) => t.priority === m.key).length }));

        const assigneeMap = new Map<string, { name: string; total: number; completed: number }>();
        for (const t of tasks) {
          const key = t.assignedTo?.id ?? "__none__";
          const name = t.assignedTo?.name ?? "Sin asignar";
          const entry = assigneeMap.get(key) ?? { name, total: 0, completed: 0 };
          entry.total += 1;
          if (t.status === "COMPLETADO") entry.completed += 1;
          assigneeMap.set(key, entry);
        }
        const byAssignee = [...assigneeMap.values()].sort((a, b) => b.total - a.total);

        return { total, completed, overdue, estimated, rate, byStatus, byPriority, byAssignee };
      })()
    : null;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", margin: 0 }}>
          Reportes de proyectos
        </h1>
        <PrintButton />
      </div>

      {/* Encabezado solo para impresión / PDF */}
      <div className="hidden print-block" style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Reportes de proyectos</h1>
        <p style={{ fontSize: "0.8125rem", color: "#6b7280", marginTop: "0.25rem" }}>
          Generado el {formatDate(now.toISOString())}
          {selectedProject ? ` · Proyecto: ${selectedProject.name}` : " · Vista global"}
        </p>
      </div>

      <div className="no-print">
        <ProjectReportPicker
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          selected={selectedProjectId}
        />
      </div>

      {/* Estadísticas del proyecto individual */}
      {selectedProject && individual && (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap", marginBottom: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap" }}>
                <Link href={`/proyectos/${selectedProject.id}`} style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--app-body-text)", textDecoration: "none" }}>
                  {selectedProject.name}
                </Link>
                <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: PROJECT_STATUS_META[selectedProject.status as ProjectStatus].bg, color: PROJECT_STATUS_META[selectedProject.status as ProjectStatus].color }}>
                  {PROJECT_STATUS_META[selectedProject.status as ProjectStatus].label}
                </span>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
                {selectedProject.company?.name ?? "Sin empresa"}
                {selectedProject.manager?.name && <> · Encargado: {selectedProject.manager.name}</>}
                {selectedProject.dueDate && <> · Entrega: {formatDate(selectedProject.dueDate)}</>}
              </p>
            </div>
            <Link href={`/proyectos/${selectedProject.id}`} style={{ fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", textDecoration: "none", whiteSpace: "nowrap" }}>
              Ver proyecto →
            </Link>
          </div>

          {/* KPIs del proyecto */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
            {[
              { label: "Tareas",       value: individual.total,     color: "var(--app-body-text)" },
              { label: "Completadas",  value: individual.completed, color: "#22c55e" },
              { label: "Vencidas",     value: individual.overdue,   color: individual.overdue > 0 ? "#dc2626" : "var(--app-text-muted)" },
              { label: "Progreso",     value: individual.total > 0 ? `${individual.rate}%` : "—", color: individual.rate >= 75 ? "#16a34a" : individual.rate >= 40 ? "#b45309" : individual.total > 0 ? "#dc2626" : "var(--app-text-muted)" },
              { label: "Horas est.",   value: individual.estimated > 0 ? individual.estimated : "—", color: "var(--app-body-text)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.75rem 1rem" }}>
                <p style={{ fontSize: "1.5rem", fontWeight: 700, color }}>{value}</p>
                <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>{label}</p>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1.5rem" }}>
            {/* Por estado */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Tareas por estado
              </p>
              <div style={{ marginBottom: "0.75rem" }}>
                <SegmentBar segments={individual.byStatus.map((s) => ({ value: s.count, color: s.color, label: s.label }))} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {individual.byStatus.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: s.color, flexShrink: 0 }} />
                    <span style={{ color: "var(--app-text-muted)", flex: 1 }}>{s.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--app-body-text)" }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por prioridad */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Tareas por prioridad
              </p>
              <div style={{ marginBottom: "0.75rem" }}>
                <SegmentBar segments={individual.byPriority.map((s) => ({ value: s.count, color: s.color, label: s.label }))} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {individual.byPriority.map((s) => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                    <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: s.color, flexShrink: 0 }} />
                    <span style={{ color: "var(--app-text-muted)", flex: 1 }}>{s.label}</span>
                    <span style={{ fontWeight: 600, color: "var(--app-body-text)" }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por responsable */}
            <div>
              <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>
                Por responsable
              </p>
              {individual.byAssignee.length === 0 ? (
                <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>Sin tareas.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {individual.byAssignee.map((a) => (
                    <div key={a.name} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem" }}>
                      <span style={{ color: "var(--app-body-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                      <span style={{ color: "var(--app-text-muted)" }}>{a.completed}/{a.total}</span>
                      <div style={{ width: "60px" }}>
                        <MiniBar value={pct(a.completed, a.total)} color={pct(a.completed, a.total) >= 75 ? "#22c55e" : pct(a.completed, a.total) >= 40 ? "#f59e0b" : "#ef4444"} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vista global — se oculta al ver un proyecto individual */}
      {!selectedProject && (
      <>
      {/* Global KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
        {[
          { label: "Proyectos",      value: totalProjects,  color: "var(--app-body-text)" },
          { label: "Tareas totales", value: totalTasks,     color: "var(--app-body-text)" },
          { label: "Completadas",    value: completedTasks, color: "#22c55e" },
          { label: "Vencidas",       value: overdueTasks,   color: overdueTasks > 0 ? "#dc2626" : "var(--app-text-muted)" },
          { label: "Tasa global",    value: totalTasks > 0 ? `${completionRate}%` : "—", color: completionRate >= 75 ? "#16a34a" : completionRate >= 40 ? "#b45309" : totalTasks > 0 ? "#dc2626" : "var(--app-text-muted)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1rem 1.25rem" }}>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, color }}>{value}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Projects by status */}
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.25rem", marginBottom: "1.75rem" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
          Proyectos por estado
        </p>

        {/* Stacked bar */}
        <div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", gap: "2px", marginBottom: "1rem" }}>
          {byStatus.filter((s) => s.count > 0).map((s) => (
            <div key={s.key} title={`${s.label}: ${s.count}`} style={{ flex: s.count, backgroundColor: s.color }} />
          ))}
          {totalProjects === 0 && <div style={{ flex: 1, backgroundColor: "var(--app-border)" }} />}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
          {byStatus.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "2px", backgroundColor: s.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>{s.label}</span>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>{s.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-project table */}
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              {["Proyecto", "Estado", ...(admin || staff ? ["Empresa"] : []), "Encargado", "Tareas", "Completadas", "Vencidas", "Progreso"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
                  No hay proyectos para mostrar.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              const sm = PROJECT_STATUS_META[row.status as ProjectStatus];
              return (
                <tr key={row.id} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--app-border)" : "none" }}>
                  {/* Proyecto */}
                  <td style={{ padding: "0.875rem 1rem", minWidth: "180px" }}>
                    <Link
                      href={`/proyectos/${row.id}`}
                      style={{ fontWeight: 600, color: "var(--app-body-text)", textDecoration: "none" }}
                    >
                      {row.name}
                    </Link>
                  </td>

                  {/* Estado */}
                  <td style={{ padding: "0.875rem 1rem", whiteSpace: "nowrap" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: sm.bg, color: sm.color }}>
                      {sm.label}
                    </span>
                  </td>

                  {/* Empresa (solo admin/staff) */}
                  {(admin || staff) && (
                    <td style={{ padding: "0.875rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                      {row.company?.name ?? "—"}
                    </td>
                  )}

                  {/* Encargado */}
                  <td style={{ padding: "0.875rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {row.manager?.name ?? "—"}
                  </td>

                  {/* Total tareas */}
                  <td style={{ padding: "0.875rem 1rem", fontWeight: 500, color: "var(--app-body-text)" }}>
                    {row.total}
                  </td>

                  {/* Completadas */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    <span style={{ color: row.completed > 0 ? "#16a34a" : "var(--app-text-muted)", fontWeight: 500 }}>
                      {row.completed}
                    </span>
                  </td>

                  {/* Vencidas */}
                  <td style={{ padding: "0.875rem 1rem" }}>
                    {row.overdue > 0 ? (
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", backgroundColor: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
                        {row.overdue}
                      </span>
                    ) : (
                      <span style={{ color: "var(--app-text-muted)" }}>—</span>
                    )}
                  </td>

                  {/* Progreso */}
                  <td style={{ padding: "0.875rem 1rem", minWidth: "120px" }}>
                    {row.total > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <MiniBar
                          value={row.rate}
                          color={row.rate >= 75 ? "#22c55e" : row.rate >= 40 ? "#f59e0b" : "#ef4444"}
                        />
                        <span style={{ fontSize: "0.75rem", fontWeight: 600, color: row.rate >= 75 ? "#16a34a" : row.rate >= 40 ? "#b45309" : "#dc2626", minWidth: "2.5rem", textAlign: "right" }}>
                          {row.rate}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>Sin tareas</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
