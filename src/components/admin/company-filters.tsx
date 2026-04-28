"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const TYPE_OPTIONS = [
  { value: "",        label: "Todos los tipos" },
  { value: "AGENCIA", label: "Agencia" },
  { value: "EMPRESA", label: "Empresa" },
];

const STATUS_OPTIONS = [
  { value: "",      label: "Todos los estados" },
  { value: "true",  label: "Activa" },
  { value: "false", label: "Inactiva" },
];

type Agency = { id: string; name: string };

const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
};

export function CompanyFilters({ agencies }: { agencies: Agency[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/admin/companies?${next.toString()}`));
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={params.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
        style={SELECT_STYLE}
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <select
        value={params.get("isActive") ?? ""}
        onChange={(e) => update("isActive", e.target.value)}
        style={SELECT_STYLE}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {agencies.length > 0 && (
        <select
          value={params.get("parentId") ?? ""}
          onChange={(e) => update("parentId", e.target.value)}
          style={SELECT_STYLE}
        >
          <option value="">Todas las agencias</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
