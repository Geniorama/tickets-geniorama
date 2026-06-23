import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Plus, LayoutTemplate } from "lucide-react";
import { TicketTemplateActions } from "@/components/tickets/ticket-template-actions";

export const metadata = { title: "Plantillas de ticket" };

const PRIORITY_LABEL: Record<string, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};

export default async function TicketTemplatesPage() {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  const templates = await prisma.ticketTemplate.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const th: React.CSSProperties = {
    textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)",
    fontWeight: 500, fontSize: "0.8125rem",
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          Plantillas de ticket
        </h1>
        <Link
          href="/tickets/plantillas/new"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.375rem",
            backgroundColor: "#fd1384", color: "#ffffff", padding: "0.5rem 1rem",
            borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
          }}
        >
          <Plus style={{ width: "1rem", height: "1rem" }} />
          Nueva plantilla
        </Link>
      </div>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
        Plantillas reutilizables para crear tickets más rápido. Úsalas para prellenar el formulario de
        «Nuevo ticket».
      </p>

      {templates.length === 0 ? (
        <div style={{ padding: "3rem", textAlign: "center", border: "1px solid var(--app-border)", borderRadius: "0.75rem", backgroundColor: "var(--app-card-bg)" }}>
          <LayoutTemplate style={{ width: "2.5rem", height: "2.5rem", color: "var(--app-text-muted)", margin: "0 auto 0.75rem" }} />
          <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
            Aún no hay plantillas. Crea una para reutilizar tickets frecuentes.
          </p>
        </div>
      ) : (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
              <thead>
                <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
                  <th style={th}>Plantilla</th>
                  <th style={th}>Prioridad</th>
                  <th style={th}>Categoría</th>
                  <th style={th}>Checklist</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {templates.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < templates.length - 1 ? "1px solid var(--app-border)" : "none" }}>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <span style={{ fontWeight: 600, color: "var(--app-body-text)" }}>{t.name}</span>
                      <div style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                        {t.title}
                        {t.createdBy?.name ? ` · ${t.createdBy.name}` : ""}
                      </div>
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                      {PRIORITY_LABEL[t.priority] ?? t.priority}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                      {t.category ?? "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                      {t.checklist.length > 0 ? `${t.checklist.length} ítem${t.checklist.length !== 1 ? "s" : ""}` : "—"}
                    </td>
                    <td style={{ padding: "0.75rem 1rem" }}>
                      <TicketTemplateActions id={t.id} name={t.name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
