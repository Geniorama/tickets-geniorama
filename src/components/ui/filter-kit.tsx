"use client";

/**
 * Kit único de filtros y ordenamiento para listas, tablas y tableros.
 *
 * Todo el estado vive en la URL (searchParams), así los filtros se pueden
 * compartir y sobreviven a un refresh. Los controles comparten altura, borde,
 * radio y tipografía: no copiar estilos de filtros en otros archivos, usar esto.
 *
 *   <FilterBar search={<SearchInput />} sort={<SortSelect ... />}>
 *     <FilterField label="Estado"><FilterMulti ... /></FilterField>
 *     <FilterToggle param="overdue" tone="red" icon={AlertTriangle}>Solo vencidos</FilterToggle>
 *   </FilterBar>
 */

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { MultiSelect } from "@/components/ui/multi-select";

/* ── Estilo base de todo control ───────────────────────────────────────── */

export const FILTER_CONTROL_STYLE: React.CSSProperties = {
  boxSizing: "border-box",
  height: "2.25rem",
  width: "100%",
  padding: "0 0.75rem",
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  fontSize: "0.8125rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
};

/* ── Hook de estado en URL ─────────────────────────────────────────────── */

type Opts = {
  /**
   * Cuando se quitan todos los filtros deja `?clear=1` para que la página no
   * vuelva a aplicar sus filtros por defecto (tickets, panel, tareas).
   */
  clearSentinel?: boolean;
  /**
   * Actualiza la URL sin pedir la página al servidor (history.replaceState).
   * Para tableros que ya traen todos los datos y filtran en el cliente.
   */
  shallow?: boolean;
};

export function useUrlFilters({ clearSentinel = false, shallow = false }: Opts = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const push = useCallback(
    (next: URLSearchParams) => {
      next.delete("page");
      if (clearSentinel && [...next.keys()].length === 0) next.set("clear", "1");
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (shallow) {
        window.history.replaceState(null, "", url);
        return;
      }
      startTransition(() => router.push(url));
    },
    [clearSentinel, shallow, pathname, router],
  );

  const set = useCallback(
    (key: string, value: string | string[] | null) => {
      const next = new URLSearchParams(params.toString());
      const encoded = Array.isArray(value) ? value.join(",") : (value ?? "");
      if (encoded) {
        next.set(key, encoded);
        next.delete("clear");
      } else {
        next.delete(key);
      }
      push(next);
    },
    [params, push],
  );

  const get = (key: string) => params.get(key) ?? "";
  const getList = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];

  return { params, pending, set, get, getList, push };
}

/* ── Contenedor de la barra ────────────────────────────────────────────── */

export function FilterBar({
  search,
  sort,
  children,
  extra,
}: {
  /** Normalmente <SearchInput />. */
  search?: React.ReactNode;
  /** Normalmente <SortSelect />. */
  sort?: React.ReactNode;
  /** Los filtros (FilterField / FilterToggle). */
  children?: React.ReactNode;
  /** Lo que va junto al orden a la derecha (vista, tamaño de página…). */
  extra?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        width: "100%",
        marginBottom: "1rem",
      }}
    >
      {(search || sort || extra) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          {search}
          <div style={{ marginLeft: "auto", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            {sort}
            {extra}
          </div>
        </div>
      )}
      {children && (
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(11.5rem, 1fr))",
            alignItems: "end",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Campo con etiqueta ────────────────────────────────────────────────── */

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label
        style={{
          display: "block",
          marginBottom: "0.25rem",
          fontSize: "0.6875rem",
          fontWeight: 600,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color: "var(--app-text-muted)",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

/* ── Controles ─────────────────────────────────────────────────────────── */

/** Selección múltiple (varios valores separados por coma en la URL). */
export function FilterMulti({
  param,
  options,
  placeholder = "Todos",
  searchable,
  filters,
}: {
  param: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchable?: boolean;
  filters: ReturnType<typeof useUrlFilters>;
}) {
  return (
    <MultiSelect
      options={options}
      value={filters.getList(param)}
      onChange={(v) => filters.set(param, v)}
      placeholder={placeholder}
      searchable={searchable ?? options.length > 8}
      triggerStyle={FILTER_CONTROL_STYLE}
    />
  );
}

/** Selección única (un valor en la URL). La primera opción debería ser "Todos" con value "". */
export function FilterSelect({
  param,
  options,
  filters,
}: {
  param: string;
  options: { value: string; label: string }[];
  filters: ReturnType<typeof useUrlFilters>;
}) {
  return (
    <select
      value={filters.get(param)}
      onChange={(e) => filters.set(param, e.target.value)}
      style={{ ...FILTER_CONTROL_STYLE, cursor: "pointer" }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Fecha (un valor ISO en la URL). */
export function FilterDate({
  param,
  filters,
}: {
  param: string;
  filters: ReturnType<typeof useUrlFilters>;
}) {
  return (
    <input
      type="date"
      value={filters.get(param)}
      onChange={(e) => filters.set(param, e.target.value)}
      style={FILTER_CONTROL_STYLE}
    />
  );
}

type Tone = "red" | "green" | "amber" | "blue" | "indigo";

/** Interruptor tipo chip: `?param=1` encendido, ausente apagado. */
export function FilterToggle({
  param,
  filters,
  tone = "indigo",
  icon: Icon,
  children,
}: {
  param: string;
  filters: ReturnType<typeof useUrlFilters>;
  tone?: Tone;
  icon?: React.ElementType;
  children: React.ReactNode;
}) {
  const on = filters.get(param) === "1";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => filters.set(param, on ? null : "1")}
      style={{
        ...FILTER_CONTROL_STYLE,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.375rem",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        backgroundColor: on ? `var(--tone-${tone}-bg)` : "var(--app-card-bg)",
        color: on ? `var(--tone-${tone}-fg)` : "var(--app-text-muted)",
        borderColor: on ? `var(--tone-${tone}-bd)` : "var(--app-border)",
      }}
    >
      {Icon && <Icon style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0 }} />}
      {children}
    </button>
  );
}

/* ── Ordenamiento ──────────────────────────────────────────────────────── */

/**
 * "Ordenar por" + dirección. Escribe `sortBy` y `sortDir` en la URL: los mismos
 * parámetros que usan las cabeceras clicables (SortableHeader), así que ambos
 * se mantienen sincronizados donde conviven.
 */
export function SortSelect({
  options,
  defaultSortBy,
  defaultSortDir = "desc",
  shallow = false,
}: {
  options: { value: string; label: string }[];
  defaultSortBy: string;
  defaultSortDir?: "asc" | "desc";
  shallow?: boolean;
}) {
  const filters = useUrlFilters({ shallow });
  const sortBy = filters.get("sortBy") || defaultSortBy;
  const sortDir = (filters.get("sortDir") || defaultSortDir) === "asc" ? "asc" : "desc";
  const DirIcon = sortDir === "asc" ? ArrowUp : ArrowDown;

  function update(nextBy: string, nextDir: string) {
    const next = new URLSearchParams(filters.params.toString());
    next.set("sortBy", nextBy);
    next.set("sortDir", nextDir);
    filters.push(next);
  }

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
        Ordenar por
      </span>
      <select
        aria-label="Ordenar por"
        value={sortBy}
        onChange={(e) => update(e.target.value, sortDir)}
        style={{ ...FILTER_CONTROL_STYLE, width: "auto", cursor: "pointer" }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => update(sortBy, sortDir === "asc" ? "desc" : "asc")}
        title={sortDir === "asc" ? "Ascendente (clic para invertir)" : "Descendente (clic para invertir)"}
        aria-label="Invertir dirección del orden"
        style={{
          ...FILTER_CONTROL_STYLE,
          width: "2.25rem",
          padding: 0,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--app-body-text)",
        }}
      >
        <DirIcon style={{ width: "0.875rem", height: "0.875rem" }} />
      </button>
    </div>
  );
}
