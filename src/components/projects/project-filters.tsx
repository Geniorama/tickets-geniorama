"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PLANIFICACION", label: "Planificación" },
  { value: "EN_DESARROLLO", label: "En desarrollo" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO", label: "Completado" },
  { value: "PAUSADO", label: "Pausado" },
];

type Company = { id: string; name: string };
type Manager = { id: string; name: string };

const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
};

const INPUT_STYLE: React.CSSProperties = {
  ...SELECT_STYLE,
  colorScheme: "dark",
};

export function ProjectFilters({
  companies,
  managers,
  showCompany,
  showManager,
}: {
  companies: Company[];
  managers: Manager[];
  showCompany: boolean;
  showManager: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.push(`/proyectos?${next.toString()}`));
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={params.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
        style={SELECT_STYLE}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {showCompany && companies.length > 0 && (
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

      {showManager && managers.length > 0 && (
        <select
          value={params.get("managerId") ?? ""}
          onChange={(e) => update("managerId", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Todos los encargados</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
          Entrega desde
        </span>
        <input
          type="date"
          value={params.get("dueDateFrom") ?? ""}
          onChange={(e) => update("dueDateFrom", e.target.value)}
          style={INPUT_STYLE}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
          hasta
        </span>
        <input
          type="date"
          value={params.get("dueDateTo") ?? ""}
          onChange={(e) => update("dueDateTo", e.target.value)}
          style={INPUT_STYLE}
        />
      </div>
    </div>
  );
}
