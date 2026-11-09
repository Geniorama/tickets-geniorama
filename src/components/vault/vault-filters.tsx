"use client";

import {
  FilterBar, FilterField, FilterSelect, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

type Option = { id: string; name: string };

const SORT_OPTIONS = [
  { value: "updatedAt", label: "Actualización" },
  { value: "createdAt", label: "Creación" },
  { value: "title",     label: "Título" },
];

const withAll = (label: string, list: Option[]) => [
  { value: "", label },
  ...list.map((o) => ({ value: o.id, label: o.name })),
];

export function VaultFilters({
  companies,
  services,
  creators,
  showAccess,
}: {
  companies: Option[];
  services: Option[];
  creators: Option[];
  showAccess: boolean;
}) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar por título, usuario, empresa, sitio o servicio..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="updatedAt" defaultSortDir="desc" />}
    >
      {showAccess && (
        <FilterField label="Acceso">
          <FilterSelect
            filters={filters}
            param="access"
            options={[
              { value: "", label: "Todas" },
              { value: "owned", label: "Solo mías" },
              { value: "shared", label: "Compartidas conmigo" },
            ]}
          />
        </FilterField>
      )}
      {companies.length > 0 && (
        <FilterField label="Empresa"><FilterSelect filters={filters} param="companyId" options={withAll("Todas", companies)} /></FilterField>
      )}
      {services.length > 0 && (
        <FilterField label="Servicio"><FilterSelect filters={filters} param="serviceId" options={withAll("Todos", services)} /></FilterField>
      )}
      {creators.length > 0 && (
        <FilterField label="Creado por"><FilterSelect filters={filters} param="createdById" options={withAll("Cualquiera", creators)} /></FilterField>
      )}
    </FilterBar>
  );
}
