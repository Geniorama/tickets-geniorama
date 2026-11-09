"use client";

import {
  FilterBar, FilterField, FilterSelect, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

const ROLE_OPTIONS = [
  { value: "",              label: "Todos" },
  { value: "ADMINISTRADOR", label: "Administrador" },
  { value: "COLABORADOR",   label: "Colaborador" },
  { value: "CLIENTE",       label: "Cliente" },
];

const STATUS_OPTIONS = [
  { value: "",      label: "Todos" },
  { value: "true",  label: "Activo" },
  { value: "false", label: "Inactivo" },
];

const SORT_OPTIONS = [
  { value: "createdAt", label: "Creación" },
  { value: "name",      label: "Nombre" },
  { value: "email",     label: "Email" },
  { value: "role",      label: "Rol" },
  { value: "isActive",  label: "Estado" },
];

type Company = { id: string; name: string };

export function UserFilters({ companies }: { companies: Company[] }) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar por nombre o email..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="createdAt" defaultSortDir="desc" />}
    >
      <FilterField label="Rol"><FilterSelect filters={filters} param="role" options={ROLE_OPTIONS} /></FilterField>
      <FilterField label="Estado"><FilterSelect filters={filters} param="isActive" options={STATUS_OPTIONS} /></FilterField>
      {companies.length > 0 && (
        <FilterField label="Empresa">
          <FilterSelect
            filters={filters}
            param="companyId"
            options={[{ value: "", label: "Todas" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </FilterField>
      )}
    </FilterBar>
  );
}
