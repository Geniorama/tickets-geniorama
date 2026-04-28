"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Option = { id: string; name: string };

const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
};

export function VaultFilters({
  companies,
  services,
  creators,
  showAccess,
}: {
  companies: Option[];
  services: Option[];
  creators: Option[];
  showAccess: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/boveda?${next.toString()}`));
  }

  const FILTER_KEYS = ["access", "companyId", "serviceId", "createdById"];
  const hasFilters = FILTER_KEYS.some((k) => params.get(k));

  function clearFilters() {
    const next = new URLSearchParams(params.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `/boveda?${qs}` : "/boveda"));
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      {showAccess && (
        <select
          value={params.get("access") ?? ""}
          onChange={(e) => update("access", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Todas las entradas</option>
          <option value="owned">Solo mías</option>
          <option value="shared">Compartidas conmigo</option>
        </select>
      )}

      {companies.length > 0 && (
        <select
          value={params.get("companyId") ?? ""}
          onChange={(e) => update("companyId", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Todas las empresas</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}

      {services.length > 0 && (
        <select
          value={params.get("serviceId") ?? ""}
          onChange={(e) => update("serviceId", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Todos los servicios</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}

      {creators.length > 0 && (
        <select
          value={params.get("createdById") ?? ""}
          onChange={(e) => update("createdById", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Cualquier creador</option>
          {creators.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      )}

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "0.8125rem",
            color: "var(--app-text-muted)",
            padding: "0.375rem 0.5rem",
          }}
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
