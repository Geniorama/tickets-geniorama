import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { TaskList } from "@/components/projects/task-list";
import { formatDate } from "@/lib/format-date";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return { title: `${user?.name ?? "Usuario"} — Geniorama Tickets` };
}

const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

const STATUS_META = [
  { key: "PENDIENTE",   label: "Pendiente",    color: "#64748b" },
  { key: "EN_PROGRESO", label: "En progreso",  color: "#3b82f6" },
  { key: "EN_REVISION", label: "En revisión",  color: "#8b5cf6" },
  { key: "COMPLETADO",  label: "Completado",   color: "#22c55e" },
] as const;

const PRIORITY_META = [
  { key: "CRITICA", label: "Crítica", color: "#dc2626" },
  { key: "ALTA",    label: "Alta",    color: "#f97316" },
  { key: "MEDIA",   label: "Media",   color: "#f59e0b" },
  { key: "BAJA",    label: "Baja",    color: "#64748b" },
] as const;

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function SegmentBar({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return <div style={{ height: "10px", borderRadius: "9999px", backgroundColor: "var(--app-border)" }} />;
  return (
    <div style={{ display: "flex", height: "10px", borderRadius: "9999px", overflow: "hidden", gap: "2px" }}>
      {segments.filter((s) => s.value > 0).map((seg) => (
        <div
          key={seg.label}
          title={`${seg.label}: ${seg.value}`}
          style={{
            flex: seg.value,
            backgroundColor: seg.color,
          }}
        />
      ))}
    </div>
  );
}

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;
  const now = new Date();

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
      companies: { select: { id: true, name: true } },
      assignedTasks: {
        include: {
          assignedTo: { select: { name: true } },
          createdBy:  { select: { name: true } },
          project:    { select: { id: true, name: true } },
          _count:     { select: { comments: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      },
    },
  });

  if (!user) notFound();

  const total     = user.assignedTasks.length;
  const completed = user.assignedTasks.filter((t) => t.status === "COMPLETADO").length;
  const active    = user.assignedTasks.filter((t) => t.status !== "COMPLETADO");
  const overdue   = user.assignedTasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== "COMPLETADO"
  ).length;
  const rate = pct(completed, total);

  // Status breakdown
  const byStatus = STATUS_META.map((s) => ({
    ...s,
    count: user.assignedTasks.filter((t) => t.status === s.key).length,
  }));

  // Priority breakdown
  const byPriority = PRIORITY_META.map((p) => ({
    ...p,
    count: user.assignedTasks.filter((t) => t.priority === p.key).length,
  }));

  // Projects involved
  const projectMap = new Map<string, { id: string; name: string; count: number }>();
  for (const t of user.assignedTasks) {
    const entry = projectMap.get(t.project.id) ?? { id: t.project.id, name: t.project.name, count: 0 };
    entry.count++;
    projectMap.set(t.project.id, entry);
  }
  const byProject = [...projectMap.values()].sort((a, b) => b.count - a.count);

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px" }}>
      {/* Back */}
      <Link
        href="/admin/users"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.875rem",
          color: "var(--app-text-muted)",
          textDecoration: "none",
          marginBottom: "1.25rem",
        }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver a usuarios
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
              {user.name}
            </h1>
            <span
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "0.2rem 0.6rem",
                borderRadius: "9999px",
                backgroundColor: user.isActive ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                color: user.isActive ? "#16a34a" : "#dc2626",
              }}
            >
              {user.isActive ? "Activo" : "Inactivo"}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            {user.email} · {ROLE_LABELS[user.role] ?? user.role}
            {user.companies.length > 0 && <> · {user.companies.map((c) => c.name).join(", ")}</>}
            {" · "}Usuario desde {formatDate(user.createdAt)}
          </p>
        </div>
        <Link
          href={`/admin/users/${user.id}/edit`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--app-body-text)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.5rem",
            padding: "0.4rem 0.875rem",
            textDecoration: "none",
            backgroundColor: "var(--app-card-bg)",
          }}
        >
          <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
          Editar
        </Link>
      </div>

      {/* KPI cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Tareas totales"  value={total}        color="var(--app-body-text)" />
        <StatCard label="Activas"         value={active.length} color="#3b82f6" />
        <StatCard label="Completadas"     value={completed}    color="#22c55e" />
        <StatCard
          label="Vencidas"
          value={overdue}
          color={overdue > 0 ? "#dc2626" : "var(--app-text-muted)"}
          highlight={overdue > 0}
        />
        <StatCard
          label="Tasa de éxito"
          value={total > 0 ? `${rate}%` : "—"}
          color={rate >= 75 ? "#16a34a" : rate >= 40 ? "#b45309" : total > 0 ? "#dc2626" : "var(--app-text-muted)"}
        />
      </div>

      {/* Breakdowns */}
      {total > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          {/* Status */}
          <BreakdownCard title="Por estado">
            <SegmentBar segments={byStatus.map((s) => ({ value: s.count, color: s.color, label: s.label }))} />
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {byStatus.map((s) => (
                <BreakdownRow key={s.key} label={s.label} count={s.count} total={total} color={s.color} />
              ))}
            </div>
          </BreakdownCard>

          {/* Priority */}
          <BreakdownCard title="Por prioridad">
            <SegmentBar segments={byPriority.map((p) => ({ value: p.count, color: p.color, label: p.label }))} />
            <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {byPriority.map((p) => (
                <BreakdownRow key={p.key} label={p.label} count={p.count} total={total} color={p.color} />
              ))}
            </div>
          </BreakdownCard>

          {/* Projects */}
          <BreakdownCard title="Proyectos involucrados">
            {byProject.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>—</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {byProject.slice(0, 6).map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Link
                      href={`/proyectos/${p.id}`}
                      style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {p.name}
                    </Link>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", marginLeft: "0.5rem", flexShrink: 0 }}>
                      {p.count} tarea{p.count !== 1 ? "s" : ""}
                    </span>
                  </div>
                ))}
                {byProject.length > 6 && (
                  <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>+{byProject.length - 6} más</p>
                )}
              </div>
            )}
          </BreakdownCard>
        </div>
      )}

      {/* Active tasks */}
      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
          Tareas activas
          {active.length > 0 && (
            <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 400, color: "var(--app-text-muted)" }}>
              ({active.length})
            </span>
          )}
        </h2>
        <TaskList tasks={active} />
      </section>

      {/* Completed tasks */}
      {completed > 0 && (
        <section>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
            Completadas
            <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 400, color: "var(--app-text-muted)" }}>
              ({completed})
            </span>
          </h2>
          <TaskList tasks={user.assignedTasks.filter((t) => t.status === "COMPLETADO")} />
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, color, highlight,
}: {
  label: string; value: string | number; color: string; highlight?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: highlight ? "rgba(239,68,68,0.06)" : "var(--app-card-bg)",
        border: `1px solid ${highlight ? "rgba(239,68,68,0.3)" : "var(--app-border)"}`,
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
      }}
    >
      <p style={{ fontSize: "1.75rem", fontWeight: 700, color }}>{value}</p>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>{label}</p>
    </div>
  );
}

function BreakdownCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
      }}
    >
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function BreakdownRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const w = pct(count, total);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", width: "6.5rem", flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: "6px", borderRadius: "9999px", backgroundColor: "var(--app-border)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, backgroundColor: color, borderRadius: "9999px" }} />
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-body-text)", minWidth: "1.5rem", textAlign: "right" }}>
        {count}
      </span>
    </div>
  );
}
