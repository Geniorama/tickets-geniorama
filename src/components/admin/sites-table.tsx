import Link from "next/link";
import { Globe, Building2, Pencil } from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DeleteSiteButton } from "@/components/sites/delete-site-button";

type SiteRow = {
  id: string;
  name: string;
  domain: string;
  isActive: boolean;
  documentation: string | null;
  architecture: string | null;
  company: { name: string };
};

export function SitesTable({
  sites,
  sortBy,
  sortDir,
  paramsStr,
}: {
  sites: SiteRow[];
  sortBy: string;
  sortDir: string;
  paramsStr: string;
}) {
  const sharedProps = { sortBy, sortDir, basePath: "/admin/sitios", paramsStr };

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
            <SortableHeader label="Sitio / App" column="name"      {...sharedProps} />
            <SortableHeader label="Dominio"     column="domain"    {...sharedProps} />
            <SortableHeader label="Empresa"     column="company"   {...sharedProps} />
            <th style={{ textAlign: "left", padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontWeight: 500, fontSize: "0.8125rem" }}>Docs</th>
            <SortableHeader label="Estado"      column="isActive"  {...sharedProps} />
            <th style={{ padding: "0.75rem 1rem" }} />
          </tr>
        </thead>
        <tbody>
          {sites.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: "2.5rem", textAlign: "center", color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
                No se encontraron sitios.
              </td>
            </tr>
          )}
          {sites.map((site) => (
            <tr key={site.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
              <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "var(--app-body-text)" }}>{site.name}</td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--app-text-muted)" }}>
                  <Globe style={{ width: "0.875rem", height: "0.875rem" }} />
                  {site.domain}
                </span>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", color: "var(--app-text-muted)" }}>
                  <Building2 style={{ width: "0.875rem", height: "0.875rem" }} />
                  {site.company.name}
                </span>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {site.documentation && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: "rgba(96,165,250,0.12)", color: "#60a5fa" }}>Docs</span>
                  )}
                  {site.architecture && (
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.5rem", borderRadius: "0.25rem", backgroundColor: "rgba(192,132,252,0.12)", color: "#c084fc" }}>Arq.</span>
                  )}
                  {!site.documentation && !site.architecture && (
                    <span style={{ color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>—</span>
                  )}
                </div>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <span style={{
                  fontSize: "0.75rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px",
                  backgroundColor: site.isActive ? "rgba(34,197,94,0.12)" : "rgba(100,116,139,0.12)",
                  color: site.isActive ? "#22c55e" : "#64748b",
                }}>
                  {site.isActive ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td style={{ padding: "0.75rem 1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <Link
                    href={`/admin/sitios/${site.id}/edit`}
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.8125rem", color: "#fd1384", fontWeight: 500, textDecoration: "none" }}
                  >
                    <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                    Editar
                  </Link>
                  <DeleteSiteButton siteId={site.id} siteName={site.name} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
