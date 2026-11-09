"use client";

/**
 * Los filtros del historial global.
 *
 * Van en la URL y no en estado local: un hallazgo de auditoría se comparte
 * pegando el enlace, y al volver atrás desde una ficha el filtro sigue puesto.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { FILTER_CONTROL_STYLE, FilterBar, FilterField } from "@/components/ui/filter-kit";
import {
  ACTIVITY_MODULES,
  MODULE_LABELS,
  actionsOfModule,
  type ActivityModule,
} from "@/lib/activity/catalog";

export function ActivityFilters({
  actors,
}: {
  actors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const modulo = params.get("modulo") ?? "";
  const accion = params.get("accion") ?? "";
  const persona = params.get("persona") ?? "";
  const desde = params.get("desde") ?? "";
  const hasta = params.get("hasta") ?? "";
  const q = params.get("q") ?? "";

  const hayFiltros = Boolean(modulo || accion || persona || desde || hasta || q);

  /** Cambiar un filtro vuelve a la primera página: el cursor viejo ya no aplica. */
  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);

    // Cambiar de módulo con una acción de otro puesta no devolvería nada.
    if (key === "modulo") next.delete("accion");
    next.delete("cursor");

    router.push(`/admin/actividad?${next.toString()}`);
  }

  const acciones = modulo ? actionsOfModule(modulo as ActivityModule) : [];

  const sel = { ...FILTER_CONTROL_STYLE, cursor: "pointer" } as const;

  return (
    <FilterBar
      search={
        <input
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre de la ficha…"
          onKeyDown={(e) => {
            if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value.trim());
          }}
          style={{ ...FILTER_CONTROL_STYLE, maxWidth: "22.5rem", flex: 1, minWidth: "13.75rem" }}
        />
      }
      extra={
        hayFiltros ? (
          <button
            type="button"
            onClick={() => router.push("/admin/actividad")}
            style={{ ...FILTER_CONTROL_STYLE, width: "auto", display: "inline-flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", color: "var(--app-text-muted)" }}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} aria-hidden />
            Limpiar
          </button>
        ) : null
      }
    >
      <FilterField label="Módulo">
        <select value={modulo} onChange={(e) => set("modulo", e.target.value)} style={sel}>
          <option value="">Todos</option>
          {ACTIVITY_MODULES.map((m) => (
            <option key={m} value={m}>{MODULE_LABELS[m]}</option>
          ))}
        </select>
      </FilterField>

      {/* El selector de acción solo aparece con un módulo elegido: la lista
          entera son más de setenta entradas y no se busca en ella. */}
      {acciones.length > 0 && (
        <FilterField label="Acción">
          <select value={accion} onChange={(e) => set("accion", e.target.value)} style={sel}>
            <option value="">Cualquiera</option>
            {acciones.map((a) => (
              <option key={a.key} value={a.key}>
                {a.label.charAt(0).toUpperCase() + a.label.slice(1)}
              </option>
            ))}
          </select>
        </FilterField>
      )}

      <FilterField label="Persona">
        <select value={persona} onChange={(e) => set("persona", e.target.value)} style={sel}>
          <option value="">Cualquiera</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Desde">
        <input type="date" value={desde} onChange={(e) => set("desde", e.target.value)} aria-label="Desde" style={FILTER_CONTROL_STYLE} />
      </FilterField>
      <FilterField label="Hasta">
        <input type="date" value={hasta} onChange={(e) => set("hasta", e.target.value)} aria-label="Hasta" style={FILTER_CONTROL_STYLE} />
      </FilterField>
    </FilterBar>
  );
}
