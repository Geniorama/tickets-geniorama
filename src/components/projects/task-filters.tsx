"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO", label: "Completado" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "Todas las prioridades" },
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
];

type Project = { id: string; name: string };
type Staff = { id: string; name: string };

const SELECT_STYLE: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.375rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
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

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.push(`/tareas?${next.toString()}`));
  }

  const fieldStyle: React.CSSProperties = { width: "100%" };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Estado
        </label>
        <select
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
          style={{ ...SELECT_STYLE, ...fieldStyle }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Prioridad
        </label>
        <select
          value={params.get("priority") ?? ""}
          onChange={(e) => update("priority", e.target.value)}
          style={{ ...SELECT_STYLE, ...fieldStyle }}
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
          Proyecto
        </label>
        <select
          value={params.get("projectId") ?? ""}
          onChange={(e) => update("projectId", e.target.value)}
          style={{ ...SELECT_STYLE, ...fieldStyle }}
        >
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {showAssignee && (
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
            Responsable
          </label>
          <select
            value={params.get("assignedToId") ?? ""}
            onChange={(e) => update("assignedToId", e.target.value)}
            style={{ ...SELECT_STYLE, ...fieldStyle }}
          >
            <option value="">Todos los responsables</option>
            {staff.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
