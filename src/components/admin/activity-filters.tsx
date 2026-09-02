"use client";

/**
 * Los filtros del historial global.
 *
 * Van en la URL y no en estado local: un hallazgo de auditoría se comparte
 * pegando el enlace, y al volver atrás desde una ficha el filtro sigue puesto.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  ACTIVITY_MODULES,
  MODULE_LABELS,
  actionsOfModule,
  type ActivityModule,
} from "@/lib/activity/catalog";

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200";

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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        defaultValue={q}
        placeholder="Buscar por nombre de la ficha…"
        onKeyDown={(e) => {
          if (e.key === "Enter") set("q", (e.target as HTMLInputElement).value.trim());
        }}
        className={`${selectClass} min-w-[16rem] flex-1`}
      />

      <select value={modulo} onChange={(e) => set("modulo", e.target.value)} className={selectClass}>
        <option value="">Todos los módulos</option>
        {ACTIVITY_MODULES.map((m) => (
          <option key={m} value={m}>
            {MODULE_LABELS[m]}
          </option>
        ))}
      </select>

      {/* El selector de acción solo aparece con un módulo elegido: la lista
          entera son más de setenta entradas y no se busca en ella. */}
      {acciones.length > 0 && (
        <select value={accion} onChange={(e) => set("accion", e.target.value)} className={selectClass}>
          <option value="">Cualquier acción</option>
          {acciones.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label.charAt(0).toUpperCase() + a.label.slice(1)}
            </option>
          ))}
        </select>
      )}

      <select value={persona} onChange={(e) => set("persona", e.target.value)} className={selectClass}>
        <option value="">Cualquier persona</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        value={desde}
        onChange={(e) => set("desde", e.target.value)}
        aria-label="Desde"
        className={selectClass}
      />
      <input
        type="date"
        value={hasta}
        onChange={(e) => set("hasta", e.target.value)}
        aria-label="Hasta"
        className={selectClass}
      />

      {hayFiltros && (
        <button
          type="button"
          onClick={() => router.push("/admin/actividad")}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpiar
        </button>
      )}
    </div>
  );
}
