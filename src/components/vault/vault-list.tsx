"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Lock, Building2, Globe, Server, User2, KeyRound, Plus } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format-date";

interface VaultEntry {
  id: string;
  title: string;
  username: string | null;
  url: string | null;
  createdAt: Date;
  updatedAt: Date;
  company:    { name: string } | null;
  site:       { name: string } | null;
  service:    { name: string } | null;
  createdBy:  { name: string };
  createdById: string;
  sharedWith: { userId: string }[];
}

interface VaultListProps {
  entries: VaultEntry[];
  currentUserId: string;
}

export function VaultList({ entries, currentUserId }: VaultListProps) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? entries.filter((e) => {
        const q = query.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          e.username?.toLowerCase().includes(q) ||
          e.company?.name.toLowerCase().includes(q) ||
          e.site?.name.toLowerCase().includes(q) ||
          e.service?.name.toLowerCase().includes(q) ||
          e.createdBy.name.toLowerCase().includes(q)
        );
      })
    : entries;

  if (entries.length === 0) {
    return (
      <div style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "3rem", textAlign: "center",
      }}>
        <KeyRound className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--app-icon-color)" }} />
        <p className="font-medium" style={{ color: "var(--app-body-text)" }}>No hay entradas en la bóveda</p>
        <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
          Crea tu primera credencial segura.
        </p>
        <Link
          href="/boveda/new"
          className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Search bar */}
      <div style={{ position: "relative" }}>
        <Search style={{
          position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)",
          width: "0.9375rem", height: "0.9375rem", color: "var(--app-text-muted)", pointerEvents: "none",
        }} />
        <input
          type="text"
          placeholder="Buscar por título, usuario, empresa, sitio o servicio..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            paddingLeft: "2.25rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem",
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

      {/* Results count when filtering */}
      {query && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} para &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Table */}
      <div style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", overflow: "hidden",
      }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "2.5rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
              No se encontraron entradas con ese criterio.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)" }}>
                {["Título", "Empresa", "Sitio / Servicio", "Creado por", "Fechas", "Acceso", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wide"
                    style={{ color: "var(--app-text-muted)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid var(--app-border)" }}
                  className="transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#fd1384" }} />
                      <Link
                        href={`/boveda/${e.id}`}
                        className="font-medium hover:underline"
                        style={{ color: "var(--app-body-text)" }}
                      >
                        {e.title}
                      </Link>
                    </div>
                    {e.username && (
                      <p className="text-xs mt-0.5 ml-5" style={{ color: "var(--app-text-muted)" }}>{e.username}</p>
                    )}
                  </td>

                  <td className="px-4 py-3" style={{ color: "var(--app-text-muted)" }}>
                    {e.company ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />{e.company.name}
                      </span>
                    ) : "—"}
                  </td>

                  <td className="px-4 py-3" style={{ color: "var(--app-text-muted)" }}>
                    <div className="flex flex-col gap-0.5">
                      {e.site && (
                        <span className="flex items-center gap-1 text-xs">
                          <Globe className="w-3 h-3" />{e.site.name}
                        </span>
                      )}
                      {e.service && (
                        <span className="flex items-center gap-1 text-xs">
                          <Server className="w-3 h-3" />{e.service.name}
                        </span>
                      )}
                      {!e.site && !e.service && "—"}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--app-text-muted)" }}>
                      <User2 className="w-3.5 h-3.5" />
                      {e.createdBy.name}
                      {e.createdById === currentUserId && (
                        <span className="ml-1 px-1 py-0.5 rounded text-xs"
                          style={{ backgroundColor: "rgba(253,19,132,0.15)", color: "#fd1384" }}>
                          tú
                        </span>
                      )}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                      <span className="text-xs" style={{ color: "var(--app-text-muted)" }}
                        title={formatDateTime(e.createdAt)}>
                        Creado: <span style={{ color: "var(--app-body-text)" }}>{formatDate(e.createdAt)}</span>
                      </span>
                      {e.updatedAt.getTime() !== e.createdAt.getTime() && (
                        <span className="text-xs" style={{ color: "var(--app-text-muted)" }}
                          title={formatDateTime(e.updatedAt)}>
                          Editado: <span style={{ color: "var(--app-body-text)" }}>{formatDate(e.updatedAt)}</span>
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {e.sharedWith.length > 0 ? (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: "rgba(253,19,132,0.12)", color: "#fd1384" }}>
                        +{e.sharedWith.length} usuarios
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: "var(--app-text-muted)" }}>Solo tú</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <Link href={`/boveda/${e.id}`} className="text-xs font-medium" style={{ color: "#fd1384" }}>
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
