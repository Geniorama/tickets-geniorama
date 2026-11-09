"use client";

import {
  FilterBar, FilterDate, FilterField, FilterMulti, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

interface FilterOption { id: string; name: string; }

const STATUS_OPTIONS = [
  { value: "POR_ASIGNAR", label: "Por asignar" },
  { value: "ABIERTO",     label: "Abierto" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "CERRADO",     label: "Cerrado" },
];

const SORT_OPTIONS = [
  { value: "dueDate",    label: "Fecha límite" },
  { value: "priority",   label: "Prioridad" },
  { value: "status",     label: "Estado" },
  { value: "title",      label: "Título" },
  { value: "createdAt",  label: "Creación" },
  { value: "updatedAt",  label: "Actualización" },
  { value: "assignedTo", label: "Responsable" },
  { value: "createdBy",  label: "Creado por" },
];

const toOptions = (list: FilterOption[]) => list.map((c) => ({ value: c.id, label: c.name }));

/** Búsqueda + orden para todos; filtros avanzados solo para staff. */
export function TicketFilters({
  collaborators,
  creators,
  companies,
  showFilters,
}: {
  collaborators: FilterOption[];
  creators: FilterOption[];
  companies: FilterOption[];
  showFilters: boolean;
}) {
  const filters = useUrlFilters();

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar tickets..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="dueDate" defaultSortDir="asc" />}
    >
      {showFilters && (
        <>
          <FilterField label="Estado">
            <FilterMulti filters={filters} param="status" options={STATUS_OPTIONS} placeholder="Todos" />
          </FilterField>
          <FilterField label="Asignado a">
            <FilterMulti filters={filters} param="assignedToId" options={toOptions(collaborators)} placeholder="Todos" />
          </FilterField>
          <FilterField label="Creado por">
            <FilterMulti filters={filters} param="createdById" options={toOptions(creators)} placeholder="Todos" />
          </FilterField>
          <FilterField label="Empresa">
            <FilterMulti filters={filters} param="companyId" options={toOptions(companies)} placeholder="Todas" />
          </FilterField>
          <FilterField label="Creado desde"><FilterDate filters={filters} param="createdFrom" /></FilterField>
          <FilterField label="Creado hasta"><FilterDate filters={filters} param="createdTo" /></FilterField>
          <FilterField label="Actualizado desde"><FilterDate filters={filters} param="updatedFrom" /></FilterField>
          <FilterField label="Actualizado hasta"><FilterDate filters={filters} param="updatedTo" /></FilterField>
        </>
      )}
    </FilterBar>
  );
}
