"use client";

import {
  FilterBar, FilterField, FilterSelect, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";
import { ViewToggle } from "@/components/ui/view-toggle";

const SERVICE_TYPES = [
  { value: "",              label: "Todos" },
  { value: "DOMINIO",       label: "Dominio" },
  { value: "HOSTING",       label: "Hosting" },
  { value: "CORREO",        label: "Correos" },
  { value: "SSL",           label: "SSL" },
  { value: "MANTENIMIENTO", label: "Mantenimiento" },
  { value: "OTRO",          label: "Otro" },
];

// El orden se aplica dentro de cada empresa: la lista se agrupa por empresa.
const SORT_OPTIONS = [
  { value: "dueDate",   label: "Vencimiento" },
  { value: "name",      label: "Nombre" },
  { value: "type",      label: "Tipo" },
  { value: "price",     label: "Precio" },
  { value: "createdAt", label: "Creación" },
];

export function ServiceFilters({
  companies,
  view,
}: {
  companies: { id: string; name: string }[];
  view: "grid" | "list";
}) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar servicios..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="dueDate" defaultSortDir="asc" />}
      extra={<ViewToggle current={view} />}
    >
      <FilterField label="Empresa">
        <FilterSelect
          filters={filters}
          param="companyId"
          options={[{ value: "", label: "Todas" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </FilterField>
      <FilterField label="Tipo">
        <FilterSelect filters={filters} param="type" options={SERVICE_TYPES} />
      </FilterField>
    </FilterBar>
  );
}
