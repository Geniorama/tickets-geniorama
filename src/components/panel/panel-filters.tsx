"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MultiSelect } from "@/components/ui/multi-select";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

type Staff = { id: string; name: string };

const KIND_OPTIONS = [
  { value: "ticket", label: "Tickets" },
  { value: "task", label: "Tareas" },
];

const PRIORITY_OPTIONS = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
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

export function PanelFilters({ staff }: { staff: Staff[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function push(next: URLSearchParams) {
    next.delete("page");
    if ([...next.keys()].length === 0) next.set("clear", "1");
    startTransition(() => router.push(`/panel?${next.toString()}`));
  }

  function update(key: string, values: string[]) {
    const next = new URLSearchParams(params.toString());
    const encoded = values.join(",");
    if (encoded) {
      next.set(key, encoded);
      next.delete("clear");
    } else {
      next.delete(key);
    }
    push(next);
  }

  function toggleFlag(key: string) {
    const next = new URLSearchParams(params.toString());
    if (next.get(key) === "1") next.delete(key);
    else { next.set(key, "1"); next.delete("clear"); }
    push(next);
  }

  function getValues(key: string): string[] {
    return params.get(key)?.split(",").filter(Boolean) ?? [];
  }

  const overdueOn = params.get("overdue") === "1";
  const doneOn = params.get("done") === "1";

  const flagBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    padding: "0.45rem 0.85rem",
    borderRadius: "0.5rem",
    cursor: "pointer",
    border: "1px solid var(--app-border)",
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: "var(--app-text-muted)" }}>
            Tipo
          </label>
          <MultiSelect
            options={KIND_OPTIONS}
            value={getValues("kind")}
            onChange={(v) => update("kind", v)}
            placeholder="Tickets y tareas"
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
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => toggleFlag("overdue")}
          style={{
            ...flagBase,
            backgroundColor: overdueOn ? "#fef2f2" : "var(--app-card-bg)",
            color: overdueOn ? "#b91c1c" : "var(--app-text-muted)",
            borderColor: overdueOn ? "#fecaca" : "var(--app-border)",
          }}
        >
          <AlertTriangle style={{ width: "0.875rem", height: "0.875rem" }} />
          Solo vencidos
        </button>
        <button
          type="button"
          onClick={() => toggleFlag("done")}
          style={{
            ...flagBase,
            backgroundColor: doneOn ? "#f0fdf4" : "var(--app-card-bg)",
            color: doneOn ? "#15803d" : "var(--app-text-muted)",
            borderColor: doneOn ? "#bbf7d0" : "var(--app-border)",
          }}
        >
          <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} />
          Incluir cerradas/completadas
        </button>
      </div>
    </div>
  );
}
