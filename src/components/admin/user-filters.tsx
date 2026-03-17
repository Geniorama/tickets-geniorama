"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const ROLE_OPTIONS = [
  { value: "",              label: "Todos los roles" },
  { value: "ADMINISTRADOR", label: "Administrador" },
  { value: "COLABORADOR",   label: "Colaborador" },
  { value: "CLIENTE",       label: "Cliente" },
];

const STATUS_OPTIONS = [
  { value: "",      label: "Todos los estados" },
  { value: "true",  label: "Activo" },
  { value: "false", label: "Inactivo" },
];

type Company = { id: string; name: string };

const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
};

export function UserFilters({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/admin/users?${next.toString()}`));
  }

  return (
    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
      <select
        value={params.get("role") ?? ""}
        onChange={(e) => update("role", e.target.value)}
        style={SELECT_STYLE}
      >
        {ROLE_OPTIONS.map((o) => (
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
    </div>
  );
}
