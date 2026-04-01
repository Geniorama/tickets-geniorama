"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "@/components/ui/multi-select";

const STATUS_OPTIONS = [
  { value: "PLANIFICACION", label: "Planificación" },
  { value: "EN_DESARROLLO", label: "En desarrollo" },
  { value: "EN_REVISION",   label: "En revisión" },
  { value: "COMPLETADO",    label: "Completado" },
  { value: "PAUSADO",       label: "Pausado" },
];

type Company = { id: string; name: string };
type Manager = { id: string; name: string };

const TRIGGER_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  width: "100%",
};

const INPUT_STYLE: React.CSSProperties = {
  ...TRIGGER_STYLE,
  colorScheme: "dark",
  outline: "none",
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

  function update(key: string, values: string[]) {
    const next = new URLSearchParams(params.toString());
    const encoded = values.join(",");
    if (encoded) next.set(key, encoded);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/proyectos?${next.toString()}`));
  }

  function updateSingle(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/proyectos?${next.toString()}`));
  }

  function getValues(key: string): string[] {
    return params.get(key)?.split(",").filter(Boolean) ?? [];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Estado
        </label>
        <MultiSelect
          options={STATUS_OPTIONS}
          value={getValues("status")}
          onChange={(v) => update("status", v)}
          placeholder="Todos los estados"
          triggerStyle={TRIGGER_STYLE}
        />
      </div>

      {showCompany && companies.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
            Empresa
          </label>
          <MultiSelect
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            value={getValues("companyId")}
            onChange={(v) => update("companyId", v)}
            placeholder="Todas las empresas"
            triggerStyle={TRIGGER_STYLE}
          />
        </div>
      )}

      {showManager && managers.length > 0 && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
            Encargado
          </label>
          <MultiSelect
            options={managers.map((m) => ({ value: m.id, label: m.name }))}
            value={getValues("managerId")}
            onChange={(v) => update("managerId", v)}
            placeholder="Todos los encargados"
            triggerStyle={TRIGGER_STYLE}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Entrega desde
        </label>
        <input
          type="date"
          value={params.get("dueDateFrom") ?? ""}
          onChange={(e) => updateSingle("dueDateFrom", e.target.value)}
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Entrega hasta
        </label>
        <input
          type="date"
          value={params.get("dueDateTo") ?? ""}
          onChange={(e) => updateSingle("dueDateTo", e.target.value)}
          style={INPUT_STYLE}
        />
      </div>
    </div>
  );
}
