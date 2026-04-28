"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "@/components/ui/multi-select";

interface FilterOption { id: string; name: string; }

const STATUS_OPTIONS = [
  { value: "POR_ASIGNAR", label: "Por asignar" },
  { value: "ABIERTO",     label: "Abierto" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "CERRADO",     label: "Cerrado" },
];

const TRIGGER_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  width: "100%",
};

export function TicketFilters({
  collaborators,
  creators,
  companies,
  current,
}: {
  collaborators: FilterOption[];
  creators: FilterOption[];
  companies: FilterOption[];
  current: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string | string[]) {
    const next = new URLSearchParams(params.toString());
    const encoded = Array.isArray(value) ? value.join(",") : value;
    if (encoded) next.set(key, encoded);
    else next.delete(key);
    next.delete("page");
    const qs = next.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  function getValues(key: string): string[] {
    return current[key]?.split(",").filter(Boolean) ?? [];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full mb-4">
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

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Asignado a
        </label>
        <MultiSelect
          options={collaborators.map((c) => ({ value: c.id, label: c.name }))}
          value={getValues("assignedToId")}
          onChange={(v) => update("assignedToId", v)}
          placeholder="Todos los responsables"
          triggerStyle={TRIGGER_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Creado por
        </label>
        <MultiSelect
          options={creators.map((c) => ({ value: c.id, label: c.name }))}
          value={getValues("createdById")}
          onChange={(v) => update("createdById", v)}
          placeholder="Todos los autores"
          triggerStyle={TRIGGER_STYLE}
        />
      </div>

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

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Creado desde
        </label>
        <input
          type="date"
          value={current.createdFrom ?? ""}
          onChange={(e) => update("createdFrom", e.target.value)}
          style={TRIGGER_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Creado hasta
        </label>
        <input
          type="date"
          value={current.createdTo ?? ""}
          onChange={(e) => update("createdTo", e.target.value)}
          style={TRIGGER_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Actualizado desde
        </label>
        <input
          type="date"
          value={current.updatedFrom ?? ""}
          onChange={(e) => update("updatedFrom", e.target.value)}
          style={TRIGGER_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Actualizado hasta
        </label>
        <input
          type="date"
          value={current.updatedTo ?? ""}
          onChange={(e) => update("updatedTo", e.target.value)}
          style={TRIGGER_STYLE}
        />
      </div>
    </div>
  );
}
