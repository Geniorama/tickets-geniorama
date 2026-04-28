import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Estadísticas — Geniorama Tickets" };

function pct(n: number, total: number) {
  if (total === 0) return 0;
  return Math.round((n / total) * 100);
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      style={{
        height: "6px",
        borderRadius: "9999px",
        backgroundColor: "var(--app-border)",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div style={{ height: "100%", width: `${w}%`, backgroundColor: color, borderRadius: "9999px" }} />
    </div>
  );
}

export default async function EstadisticasPage() {
  await requireRole(["ADMINISTRADOR"]);

  const now           = new Date();
  const bogotaDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
  const [by, bm, bd]  = bogotaDateStr.split("-").map(Number);
  const today         = new Date(Date.UTC(by, bm - 1, bd));

  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      assignedTasks: {
        take: 500,
        select: { status: true, dueDate: true, priority: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = users.map((u) => {
    const total     = u.assignedTasks.length;
    const completed = u.assignedTasks.filter((t) => t.status === "COMPLETADO").length;
    const inProgress = u.assignedTasks.filter((t) => t.status === "EN_PROGRESO").length;
    const pending   = u.assignedTasks.filter((t) => t.status === "PENDIENTE").length;
    const inReview  = u.assignedTasks.filter((t) => t.status === "EN_REVISION").length;
    const overdue   = u.assignedTasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status !== "COMPLETADO" && t.status !== "EN_REVISION"
    ).length;
    const rate      = pct(completed, total);
    const critical  = u.assignedTasks.filter((t) => t.priority === "CRITICA" || t.priority === "ALTA").length;

    return { ...u, total, completed, inProgress, pending, inReview, overdue, rate, critical };
  });

  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  // Totales globales
  const globalTotal     = rows.reduce((s, r) => s + r.total, 0);
  const globalCompleted = rows.reduce((s, r) => s + r.completed, 0);
  const globalInReview  = rows.reduce((s, r) => s + r.inReview, 0);
  const globalOverdue   = rows.reduce((s, r) => s + r.overdue, 0);
  const globalRate      = pct(globalCompleted, globalTotal);

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Estadísticas de productividad
      </h1>

      {/* Global summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        {[
          { label: "Tareas totales",    value: globalTotal,      color: "var(--app-body-text)" },
          { label: "Completadas",       value: globalCompleted,  color: "#22c55e" },
          { label: "En revisión",       value: globalInReview,   color: "#8b5cf6" },
          { label: "Vencidas",          value: globalOverdue,    color: "#ef4444" },
          { label: "Tasa global",       value: `${globalRate}%`, color: "#fd1384" },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "1rem 1.25rem",
            }}
          >
            <p style={{ fontSize: "1.75rem", fontWeight: 700, color }}>{value}</p>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Per-user table */}
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              {["Usuario", "Total tareas", "Completadas", "En progreso", "Revisión", "Pendientes", "Vencidas", "Alta/Crítica", "Tasa"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "0.75rem 1rem",
                    color: "var(--app-text-muted)",
                    fontWeight: 500,
                    fontSize: "0.8125rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.id}
                style={{
                  borderBottom: i < rows.length - 1 ? "1px solid var(--app-border)" : "none",
                  opacity: r.isActive ? 1 : 0.5,
                }}
              >
                {/* Usuario */}
                <td style={{ padding: "0.875rem 1rem", minWidth: "180px" }}>
                  <Link
                    href={`/admin/users/${r.id}`}
                    style={{ fontWeight: 600, color: "var(--app-body-text)", textDecoration: "none" }}
                  >
                    {r.name}
                  </Link>
                  <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0 }}>{r.email}</p>
                </td>

                {/* Total tareas con barra */}
                <td style={{ padding: "0.875rem 1rem", minWidth: "140px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontWeight: 600, color: "var(--app-body-text)", minWidth: "1.5rem" }}>{r.total}</span>
                    <div style={{ flex: 1 }}>
                      <Bar value={r.total} max={maxTotal} color="#fd1384" />
                    </div>
                  </div>
                </td>

                {/* Completadas */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span style={{ color: r.completed > 0 ? "#16a34a" : "var(--app-text-muted)", fontWeight: 500 }}>
                    {r.completed}
                  </span>
                </td>

                {/* En progreso */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span style={{ color: r.inProgress > 0 ? "#3b82f6" : "var(--app-text-muted)" }}>
                    {r.inProgress}
                  </span>
                </td>

                {/* En revisión */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span style={{ color: r.inReview > 0 ? "#8b5cf6" : "var(--app-text-muted)" }}>
                    {r.inReview}
                  </span>
                </td>

                {/* Pendientes */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  <span style={{ color: "var(--app-text-muted)" }}>{r.pending}</span>
                </td>

                {/* Vencidas */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  {r.overdue > 0 ? (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "9999px",
                        backgroundColor: "rgba(239,68,68,0.12)",
                        color: "#dc2626",
                      }}
                    >
                      {r.overdue}
                    </span>
                  ) : (
                    <span style={{ color: "var(--app-text-muted)" }}>—</span>
                  )}
                </td>

                {/* Alta/Crítica */}
                <td style={{ padding: "0.875rem 1rem" }}>
                  {r.critical > 0 ? (
                    <span style={{ color: "#f59e0b", fontWeight: 500 }}>{r.critical}</span>
                  ) : (
                    <span style={{ color: "var(--app-text-muted)" }}>—</span>
                  )}
                </td>

                {/* Tasa de completado */}
                <td style={{ padding: "0.875rem 1rem", minWidth: "100px" }}>
                  {r.total > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            height: "6px",
                            borderRadius: "9999px",
                            backgroundColor: "var(--app-border)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${r.rate}%`,
                              backgroundColor: r.rate >= 75 ? "#22c55e" : r.rate >= 40 ? "#f59e0b" : "#ef4444",
                              borderRadius: "9999px",
                            }}
                          />
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: r.rate >= 75 ? "#16a34a" : r.rate >= 40 ? "#b45309" : "#dc2626",
                          minWidth: "2.5rem",
                          textAlign: "right",
                        }}
                      >
                        {r.rate}%
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>Sin tareas</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
