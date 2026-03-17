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

  return (
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
          {plans.length === 0 && (
            <tr>
              <td colSpan={7} style={{ padding: "2.5rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
                No hay planes creados todavía.
              </td>
            </tr>
          )}
          {plans.map((plan) => (
            <tr key={plan.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
              <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "var(--app-body-text)" }}>{plan.name}</td>
              <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>{plan.company.name}</td>
              <td style={{ padding: "0.75rem 1rem" }}>
                {plan.type === "BOLSA_HORAS" ? (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: "rgba(192,132,252,0.12)", color: "#c084fc" }}>
                    Bolsa de horas
                  </span>
                ) : (
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>
                    Soporte mensual
                  </span>
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
                <span style={{
                  fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px",
                  backgroundColor: plan.statusBadge.bg, color: plan.statusBadge.color,
                }}>
                  {plan.statusBadge.label}
                </span>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <Link
                    href={`/admin/plans/${plan.id}/edit`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}
                  >
                    <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                    Editar
                  </Link>
                  <DeletePlanButton planId={plan.id} planName={plan.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
