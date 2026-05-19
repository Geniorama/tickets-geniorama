import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Plus, Repeat, PauseCircle, PlayCircle } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { describeRecurrence } from "@/lib/recurrence";

export const metadata = { title: "Tareas recurrentes" };

const PRIORITY_LABEL: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

export default async function RecurringTasksPage() {
  await requireRole(["ADMINISTRADOR"]);

  const templates = await prisma.recurringTaskTemplate.findMany({
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { name: true } },
      _count: { select: { generatedTasks: true } },
    },
    orderBy: [{ isActive: "desc" }, { nextRunAt: "asc" }],
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Tareas recurrentes
        </h1>
        <Link
          href="/admin/tareas-recurrentes/new"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
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
          Nueva plantilla
        </Link>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {templates.length} {templates.length === 1 ? "plantilla" : "plantillas"} · cron diario en{" "}
        <code style={{ fontSize: "0.75rem", padding: "0.1rem 0.35rem", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", borderRadius: "0.25rem" }}>
          /api/cron/recurring-tasks
        </code>
      </p>

      {templates.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", border: "1px solid var(--app-border)", borderRadius: "0.75rem", backgroundColor: "var(--app-card-bg)" }}>
          <Repeat style={{ width: "2.5rem", height: "2.5rem", color: "var(--app-text-muted)", margin: "0 auto 0.75rem" }} />
          <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
            No hay plantillas de tareas recurrentes. Crea una para automatizar tareas periódicas.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Título</th>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Proyecto</th>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Patrón</th>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Próxima</th>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Generadas</th>
                <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < templates.length - 1 ? "1px solid var(--app-border)" : "none" }}>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link
                      href={`/admin/tareas-recurrentes/${t.id}/edit`}
                      style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                    >
                      {t.title}
                    </Link>
                    <div style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {PRIORITY_LABEL[t.priority]}
                      {t.assignedTo ? ` · ${t.assignedTo.name}` : ""}
                      {t.dueDateOffsetDays > 0 ? ` · vence +${t.dueDateOffsetDays}d` : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {t.project?.name ?? <span style={{ fontStyle: "italic" }}>Global</span>}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {describeRecurrence({
                      frequency: t.frequency,
                      interval: t.interval,
                      daysOfWeek: t.daysOfWeek,
                      dayOfMonth: t.dayOfMonth,
                    })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem", whiteSpace: "nowrap" }}>
                    {formatDate(t.nextRunAt)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                    {t._count.generatedTasks}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    {t.isActive ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#22c55e" }}>
                        <PlayCircle style={{ width: "0.875rem", height: "0.875rem" }} />
                        Activa
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                        <PauseCircle style={{ width: "0.875rem", height: "0.875rem" }} />
                        Pausada
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
