import Link from "next/link";
import Image from "next/image";
import { Building2, Pencil } from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";
import { DeleteCompanyButton } from "@/components/admin/delete-company-button";

type CompanyRow = {
  id: string;
  name: string;
  type: string;
  taxId: string | null;
  logoUrl: string | null;
  isActive: boolean;
  parentName?: string;
  userCount: number;
};

export function CompanyTable({
  rows,
  sortBy,
  sortDir,
  paramsStr,
}: {
  rows: CompanyRow[];
  sortBy: string;
  sortDir: string;
  paramsStr: string;
}) {
  const sharedProps = { sortBy, sortDir, basePath: "/admin/companies", paramsStr };

  if (rows.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "2.5rem",
          textAlign: "center",
          color: "var(--app-text-muted)",
          fontSize: "0.875rem",
        }}
      >
        No se encontraron empresas con esos criterios.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* ── Vista mobile: cards ── */}
      <div className="md:hidden rounded-xl border border-gray-200 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-8 h-8 rounded border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                  {row.logoUrl ? (
                    <Image src={row.logoUrl} alt={row.name} width={32} height={32} className="object-contain p-0.5" />
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{row.name}</p>
                  {row.parentName && <p className="text-xs text-gray-400">{row.parentName}</p>}
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                    row.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {row.isActive ? "Activa" : "Inactiva"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap mb-1.5">
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    row.type === "AGENCIA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {row.type === "AGENCIA" ? "Agencia" : "Empresa"}
                </span>
                {row.taxId && <span>{row.taxId}</span>}
                <span>{row.userCount} usuario{row.userCount !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/companies/${row.id}/edit`}
                  className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </Link>
                <DeleteCompanyButton companyId={row.id} companyName={row.name} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden md:block rounded-xl border border-gray-200 overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              <th
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  color: "var(--app-text-muted)",
                }}
              >
                Logo
              </th>
              <SortableHeader label="Nombre"   column="name"     {...sharedProps} />
              <SortableHeader label="Tipo"     column="type"     {...sharedProps} />
              <SortableHeader label="Agencia"  column="parent"   {...sharedProps} />
              <th
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  color: "var(--app-text-muted)",
                }}
              >
                NIT / RUC
              </th>
              <SortableHeader label="Usuarios" column="users"    {...sharedProps} />
              <SortableHeader label="Estado"   column="isActive" {...sharedProps} />
              <th style={{ padding: "0.75rem 1rem" }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: "1px solid var(--app-border)" }} className="hover:bg-gray-50">
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {row.logoUrl ? (
                        <Image src={row.logoUrl} alt={row.name} width={40} height={40} className="object-contain p-1" />
                      ) : (
                        <Building2 className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: "0.75rem 1rem", fontWeight: 500, color: "var(--app-body-text)" }}>{row.name}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      row.type === "AGENCIA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {row.type === "AGENCIA" ? "Agencia" : "Empresa"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                  {row.parentName ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>{row.taxId ?? "—"}</td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>{row.userCount}</td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      row.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}
                  >
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/admin/companies/${row.id}/edit`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Link>
                    <DeleteCompanyButton companyId={row.id} companyName={row.name} />
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
