import Link from "next/link";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { Plus, Repeat, PauseCircle, PlayCircle } from "lucide-react";
import { formatDate } from "@/lib/format-date";
import { describeRecurrence } from "@/lib/recurrence";

export const metadata = { title: "Tickets recurrentes" };

const PRIORITY_LABEL: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "0.75rem 1rem",
  color: "var(--app-text-muted)",
  fontWeight: 500,
  fontSize: "0.8125rem",
};

const td: React.CSSProperties = {
  padding: "0.75rem 1rem",
  color: "var(--app-text-muted)",
  fontSize: "0.8125rem",
};

/**
 * Marca las que ya pasaron su fecha de fin.
 *
 * Vive fuera del componente porque leer el reloj dentro del render es
 * impredecible por definición —y el linter, con razón, no lo deja—. Aquí es una
 * función normal: entra la lista, sale la lista con el dato ya resuelto.
 */
function conEstado<T extends { endDate: Date | null }>(filas: T[]): (T & { terminada: boolean })[] {
  const ahora = Date.now();
  return filas.map((f) => ({
    ...f,
    terminada: f.endDate !== null && f.endDate.getTime() < ahora,
  }));
}

export default async function RecurringTicketsPage() {
  await requireCan("TICKETS", "gestionar");

  const templates = await prisma.recurringTicketTemplate.findMany({
    include: {
      client: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      plan: { select: { name: true, company: { select: { name: true } } } },
      _count: { select: { generatedTickets: true } },
    },
    // Las activas primero y, dentro, la que toca antes: es el orden en el que
    // se mira esta pantalla —qué va a pasar pronto—, no el alfabético.
    orderBy: [{ isActive: "desc" }, { nextRunAt: "asc" }],
  }).then(conEstado);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Tickets recurrentes
        </h1>
        <Link
          href="/admin/tickets-recurrentes/new"
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
          Nueva recurrencia
        </Link>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        {templates.length} {templates.length === 1 ? "recurrencia" : "recurrencias"} · barrido diario en{" "}
        <code
          style={{
            fontSize: "0.75rem",
            padding: "0.1rem 0.35rem",
            backgroundColor: "var(--app-content-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.25rem",
          }}
        >
          /api/cron/recurring-tickets
        </code>
      </p>

      {templates.length === 0 ? (
        <div
          style={{
            padding: "3rem",
            textAlign: "center",
            border: "1px solid var(--app-border)",
            borderRadius: "0.75rem",
            backgroundColor: "var(--app-card-bg)",
          }}
        >
          <Repeat style={{ width: "2.5rem", height: "2.5rem", color: "var(--app-text-muted)", margin: "0 auto 0.75rem" }} />
          <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
            No hay tickets recurrentes. Crea uno para los mantenimientos y revisiones que se
            repiten cada mes.
          </p>
        </div>
      ) : (
        <div
          style={{
            backgroundColor: "var(--app-card-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.75rem",
            overflowX: "auto",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
                <th style={th}>Título</th>
                <th style={th}>Cliente</th>
                <th style={th}>Plan</th>
                <th style={th}>Patrón</th>
                <th style={th}>Próximo</th>
                <th style={th}>Abiertos</th>
                <th style={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t, i) => (
                <tr
                  key={t.id}
                  style={{ borderBottom: i < templates.length - 1 ? "1px solid var(--app-border)" : "none" }}
                >
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link
                      href={`/admin/tickets-recurrentes/${t.id}/edit`}
                      style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                    >
                      {t.title}
                    </Link>
                    <div style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {PRIORITY_LABEL[t.priority]}
                      {t.assignedTo ? ` · ${t.assignedTo.name}` : " · sin asignar"}
                      {t.dueDateOffsetDays > 0 ? ` · vence +${t.dueDateOffsetDays}d` : ""}
                    </div>
                  </td>
                  <td style={td}>
                    {t.client?.name ?? <span style={{ fontStyle: "italic" }}>Interno</span>}
                  </td>
                  <td style={td}>
                    {t.plan ? (
                      `${t.plan.company.name} — ${t.plan.name}`
                    ) : (
                      <span style={{ fontStyle: "italic" }}>Sin plan</span>
                    )}
                  </td>
                  <td style={td}>
                    {describeRecurrence({
                      frequency: t.frequency,
                      interval: t.interval,
                      daysOfWeek: t.daysOfWeek,
                      dayOfMonth: t.dayOfMonth,
                    })}
                  </td>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>
                    {/* Una recurrencia terminada ya no abre nada aunque su
                        próxima fecha siga en el futuro por la cadencia. */}
                    {t.terminada ? (
                      <span style={{ fontStyle: "italic" }}>Terminada</span>
                    ) : (
                      formatDate(t.nextRunAt)
                    )}
                  </td>
                  <td style={td}>{t._count.generatedTickets}</td>
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
