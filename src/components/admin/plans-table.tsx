import Link from "next/link";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DeletePlanButton } from "@/components/admin/delete-plan-button";
import { formatDate } from "@/lib/format-date";
import { formatHours } from "@/lib/plans";
import { Pencil } from "lucide-react";

type PlanRow = {
  id: string;
  name: string;
  type: "BOLSA_HORAS" | "SOPORTE_MENSUAL";
  totalHours: number | null;
  usedHours: number;
  expiryDate: Date | null;
  isActive: boolean;
  statusBadge: { label: string; bg: string; color: string };
  company: { name: string };
};

export function PlansTable({
  plans,
  sortBy,
  sortDir,
  paramsStr,
}: {
  plans: PlanRow[];
  sortBy: string;
  sortDir: string;
  paramsStr: string;
}) {
  const sharedProps = { sortBy, sortDir, basePath: "/admin/plans", paramsStr };

  const container: React.CSSProperties = {
    backgroundColor: "var(--app-card-bg)",
    border: "1px solid var(--app-border)",
    borderRadius: "0.75rem",
    overflow: "hidden",
  };

  if (plans.length === 0) {
    return (
      <div style={{ ...container, padding: "2.5rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
        No hay planes creados todavía.
      </div>
    );
  }

  return (
    <div style={container}>
      {/* ── Vista mobile: cards ── */}
      <ul className="md:hidden divide-y" style={{ borderColor: "var(--app-border)" }}>
        {plans.map((plan) => (
          <li key={plan.id} style={{ padding: "0.875rem 1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ fontWeight: 600, color: "var(--app-body-text)", fontSize: "0.9375rem" }}>{plan.name}</span>
              <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: plan.statusBadge.bg, color: plan.statusBadge.color, flexShrink: 0 }}>
                {plan.statusBadge.label}
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "0.375rem" }}>{plan.company.name}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
              {plan.type === "BOLSA_HORAS" ? (
                <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", backgroundColor: "rgba(192,132,252,0.12)", color: "#c084fc" }}>Bolsa de horas</span>
              ) : (
                <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "9999px", backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>Soporte mensual</span>
              )}
              {plan.type === "BOLSA_HORAS" && plan.totalHours !== null && (
                <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>{formatHours(plan.usedHours)} / {formatHours(plan.totalHours)}</span>
              )}
              {plan.expiryDate && (
                <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>Vence: {formatDate(plan.expiryDate)}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Link href={`/admin/plans/${plan.id}/edit`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}>
                <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />Editar
              </Link>
              <DeletePlanButton planId={plan.id} planName={plan.name} />
            </div>
          </li>
        ))}
      </ul>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              <SortableHeader label="Nombre"    column="name"      {...sharedProps} />
              <SortableHeader label="Empresa"   column="company"   {...sharedProps} />
              <SortableHeader label="Tipo"      column="type"      {...sharedProps} />
              <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Horas</th>
              <SortableHeader label="Caducidad" column="expiresAt" {...sharedProps} />
              <SortableHeader label="Estado"    column="isActive"  {...sharedProps} />
              <th style={{ padding: "0.75rem 1rem" }} />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "var(--app-body-text)" }}>{plan.name}</td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>{plan.company.name}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  {plan.type === "BOLSA_HORAS" ? (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: "rgba(192,132,252,0.12)", color: "#c084fc" }}>Bolsa de horas</span>
                  ) : (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>Soporte mensual</span>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>
                  {plan.type === "BOLSA_HORAS" && plan.totalHours !== null ? (
                    <span>{formatHours(plan.usedHours)} / {formatHours(plan.totalHours)}</span>
                  ) : (
                    <span style={{ opacity: 0.4 }}>—</span>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                  {plan.expiryDate ? formatDate(plan.expiryDate) : <span style={{ opacity: 0.4 }}>Sin caducidad</span>}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: plan.statusBadge.bg, color: plan.statusBadge.color }}>
                    {plan.statusBadge.label}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Link href={`/admin/plans/${plan.id}/edit`} style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}>
                      <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />Editar
                    </Link>
                    <DeletePlanButton planId={plan.id} planName={plan.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
