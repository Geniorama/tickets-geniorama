"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Building2, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
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
  indent?: boolean;
};

export function CompanyTable({ rows }: { rows: CompanyRow[] }) {
  const [query, setQuery] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const filtered = query.trim()
    ? rows.filter((r) => {
        const q = query.toLowerCase();
        return (
          r.name.toLowerCase().includes(q) ||
          r.taxId?.toLowerCase().includes(q) ||
          r.parentName?.toLowerCase().includes(q)
        );
      })
    : rows;

  function sortedRows(rowList: CompanyRow[]) {
    function val(r: CompanyRow): string | number {
      switch (sortCol) {
        case "name":     return r.name;
        case "type":     return r.type;
        case "parent":   return r.parentName ?? "";
        case "users":    return r.userCount;
        case "isActive": return r.isActive ? 1 : 0;
        default:         return r.name;
      }
    }
    function cmp(a: CompanyRow, b: CompanyRow) {
      const av = val(a), bv = val(b);
      if (typeof av === "number") return sortAsc ? av - (bv as number) : (bv as number) - av;
      return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    }

    // Ordenar preservando jerarquía: agencia → sus subempresas → empresas sueltas
    const agencies    = rowList.filter((r) => r.type === "AGENCIA");
    const standalones = rowList.filter((r) => !r.indent && r.type === "EMPRESA");
    const result: CompanyRow[] = [];
    for (const agency of [...agencies].sort(cmp)) {
      result.push(agency);
      const subs = rowList.filter((r) => r.indent && r.parentName === agency.name);
      result.push(...[...subs].sort(cmp));
    }
    result.push(...[...standalones].sort(cmp));
    return result;
  }

  function ColHeader({ label, col }: { label: string; col: string }) {
    const isActive = sortCol === col;
    const Icon = isActive ? (sortAsc ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        onClick={() => {
          if (sortCol === col) setSortAsc((v) => !v);
          else { setSortCol(col); setSortAsc(true); }
        }}
        style={{
          textAlign: "left", padding: "0.75rem 1rem", fontWeight: 500, fontSize: "0.8125rem",
          cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
          color: isActive ? "#fd1384" : "var(--app-text-muted)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          {label}
          <Icon style={{ width: "0.75rem", height: "0.75rem", opacity: isActive ? 1 : 0.35 }} />
        </span>
      </th>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search
          style={{
            position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
            width: "0.9375rem", height: "0.9375rem", color: "var(--app-text-muted)", pointerEvents: "none",
          }}
        />
        <input
          type="text"
          placeholder="Buscar empresas..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: "2.25rem", paddingRight: query ? "2rem" : "0.75rem",
            paddingTop: "0.5rem", paddingBottom: "0.5rem",
            border: "1px solid var(--app-border)", borderRadius: "0.5rem",
            fontSize: "0.875rem", color: "var(--app-body-text)",
            backgroundColor: "var(--app-card-bg)", outline: "none",
          }}
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            style={{
              position: "absolute", right: "0.625rem", top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer",
              fontSize: "0.75rem", color: "var(--app-text-muted)",
            }}
          >
            ✕
          </button>
        )}
      </div>

      {query && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &ldquo;{query}&rdquo;
        </p>
      )}

      {/* ── Vista mobile: cards ── */}
      <div className="md:hidden rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <p className="px-4 py-8 text-center text-gray-400 text-sm">
            {query ? "No se encontraron empresas con ese criterio." : "No hay empresas registradas."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sortedRows(filtered).map((row) => (
              <li key={row.id} className={`px-4 py-3 ${row.indent ? "bg-gray-50/40 pl-8" : ""}`}>
                <div className="flex items-center gap-3 mb-1.5">
                  {row.indent && <span className="text-gray-300 text-base leading-none shrink-0">└</span>}
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
                  <span className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${row.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded font-medium ${row.type === "AGENCIA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                    {row.type === "AGENCIA" ? "Agencia" : "Empresa"}
                  </span>
                  {row.taxId && <span>{row.taxId}</span>}
                  <span>{row.userCount} usuario{row.userCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/companies/${row.id}/edit`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                    <Pencil className="w-3.5 h-3.5" />Editar
                  </Link>
                  <DeleteCompanyButton companyId={row.id} companyName={row.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Vista desktop: tabla ── */}
      <div className="hidden md:block rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium" style={{ fontSize: "0.8125rem" }}>Logo</th>
              <ColHeader label="Nombre"   col="name"     />
              <ColHeader label="Tipo"     col="type"     />
              <ColHeader label="Agencia"  col="parent"   />
              <th className="text-left px-4 py-3 text-gray-600 font-medium" style={{ fontSize: "0.8125rem" }}>NIT / RUC</th>
              <ColHeader label="Usuarios" col="users"    />
              <ColHeader label="Estado"   col="isActive" />
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  {query ? "No se encontraron empresas con ese criterio." : "No hay empresas registradas."}
                </td>
              </tr>
            )}
            {sortedRows(filtered).map((row) => (
              <tr key={row.id} className={`hover:bg-gray-50 ${row.indent ? "bg-gray-50/40" : ""}`}>
                <td className="px-4 py-3">
                  <div className={`flex items-center ${row.indent ? "pl-4" : ""}`}>
                    {row.indent && <span className="text-gray-300 mr-2 text-base leading-none">└</span>}
                    <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {row.logoUrl ? (
                        <Image src={row.logoUrl} alt={row.name} width={40} height={40} className="object-contain p-1" />
                      ) : (
                        <Building2 className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 font-medium text-gray-900 ${row.indent ? "pl-4" : ""}`}>{row.name}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.type === "AGENCIA" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                    {row.type === "AGENCIA" ? "Agencia" : "Empresa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{row.parentName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-500">{row.taxId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{row.userCount}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${row.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/companies/${row.id}/edit`} className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      <Pencil className="w-3.5 h-3.5" />Editar
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
