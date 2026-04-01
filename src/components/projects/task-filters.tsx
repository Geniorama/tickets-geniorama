"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "@/components/ui/multi-select";

const STATUS_OPTIONS = [
  { value: "PENDIENTE",   label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO",  label: "Completado" },
];

const PRIORITY_OPTIONS = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA",    label: "Alta" },
  { value: "MEDIA",   label: "Media" },
  { value: "BAJA",    label: "Baja" },
];

type Project = { id: string; name: string };
type Staff   = { id: string; name: string };

const TRIGGER_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  width: "100%",
};

export function TaskFilters({
  projects,
  staff,
  showAssignee,
}: {
  projects: Project[];
  staff: Staff[];
  showAssignee: boolean;
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
    startTransition(() => router.push(`/tareas?${next.toString()}`));
  }

  function getValues(key: string): string[] {
    return params.get(key)?.split(",").filter(Boolean) ?? [];
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
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
          Prioridad
        </label>
        <MultiSelect
          options={PRIORITY_OPTIONS}
          value={getValues("priority")}
          onChange={(v) => update("priority", v)}
          placeholder="Todas las prioridades"
          triggerStyle={TRIGGER_STYLE}
        />
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Proyecto
        </label>
        <MultiSelect
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          value={getValues("projectId")}
          onChange={(v) => update("projectId", v)}
          placeholder="Todos los proyectos"
          triggerStyle={TRIGGER_STYLE}
        />
      </div>

      {showAssignee && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
            Responsable
          </label>
          <MultiSelect
            options={staff.map((u) => ({ value: u.id, label: u.name }))}
            value={getValues("assignedToId")}
            onChange={(v) => update("assignedToId", v)}
            placeholder="Todos los responsables"
            triggerStyle={TRIGGER_STYLE}
          />
        </div>
      )}
    </div>
  );
}
