"use client";

import {
  FilterBar, FilterField, FilterSelect, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

const TYPE_OPTIONS = [
  { value: "",        label: "Todos" },
  { value: "AGENCIA", label: "Agencia" },
  { value: "EMPRESA", label: "Empresa" },
];

const STATUS_OPTIONS = [
  { value: "",      label: "Todos" },
  { value: "true",  label: "Activa" },
  { value: "false", label: "Inactiva" },
];

const SORT_OPTIONS = [
  { value: "name",     label: "Nombre" },
  { value: "type",     label: "Tipo" },
  { value: "parent",   label: "Agencia" },
  { value: "users",    label: "Usuarios" },
  { value: "isActive", label: "Estado" },
];

type Agency = { id: string; name: string };

export function CompanyFilters({ agencies }: { agencies: Agency[] }) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar por nombre o NIT..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="name" defaultSortDir="asc" />}
    >
      <FilterField label="Tipo"><FilterSelect filters={filters} param="type" options={TYPE_OPTIONS} /></FilterField>
      <FilterField label="Estado"><FilterSelect filters={filters} param="isActive" options={STATUS_OPTIONS} /></FilterField>
      {agencies.length > 0 && (
        <FilterField label="Agencia">
          <FilterSelect
            filters={filters}
            param="parentId"
            options={[{ value: "", label: "Todas" }, ...agencies.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </FilterField>
      )}
    </FilterBar>
  );
}
