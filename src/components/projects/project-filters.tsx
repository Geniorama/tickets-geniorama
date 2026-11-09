"use client";

import {
  FilterBar, FilterDate, FilterField, FilterMulti, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";
import { PROJECT_STATES, PROJECT_STATE_LABEL } from "@/lib/project-state";

// Borrador solo trae los propios: los ajenos no son visibles para nadie
const STATUS_OPTIONS = PROJECT_STATES.map((s) => ({ value: s, label: PROJECT_STATE_LABEL[s] }));

const SORT_OPTIONS = [
  { value: "createdAt", label: "Creación" },
  { value: "updatedAt", label: "Actualización" },
  { value: "name",      label: "Nombre" },
  { value: "dueDate",   label: "Fecha de entrega" },
  { value: "startDate", label: "Fecha de inicio" },
];

type Company = { id: string; name: string };
type Manager = { id: string; name: string };

export function ProjectFilters({
  companies,
  managers,
  showCompany,
  showManager,
}: {
  companies: Company[];
  managers: Manager[];
  showCompany: boolean;
  showManager: boolean;
}) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar proyectos..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="createdAt" defaultSortDir="desc" />}
    >
      <FilterField label="Estado">
        <FilterMulti filters={filters} param="status" options={STATUS_OPTIONS} placeholder="Todos" />
      </FilterField>
      {showCompany && companies.length > 0 && (
        <FilterField label="Empresa">
          <FilterMulti
            filters={filters}
            param="companyId"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="Todas"
          />
        </FilterField>
      )}
      {showManager && managers.length > 0 && (
        <FilterField label="Encargado">
          <FilterMulti
            filters={filters}
            param="managerId"
            options={managers.map((m) => ({ value: m.id, label: m.name }))}
            placeholder="Todos"
          />
        </FilterField>
      )}
      <FilterField label="Entrega desde"><FilterDate filters={filters} param="dueDateFrom" /></FilterField>
      <FilterField label="Entrega hasta"><FilterDate filters={filters} param="dueDateTo" /></FilterField>
    </FilterBar>
  );
}
