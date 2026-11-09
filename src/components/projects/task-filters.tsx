"use client";

import {
  FilterBar, FilterField, FilterMulti, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

const STATUS_OPTIONS = [
  { value: "PENDIENTE",   label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO",  label: "Completado" },
];

const PRIORITY_OPTIONS = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA",    label: "Alta" },
  { value: "MEDIA",   label: "Media" },
  { value: "BAJA",    label: "Baja" },
];

const SORT_OPTIONS = [
  { value: "dueDate",        label: "Fecha límite" },
  { value: "priority",       label: "Prioridad" },
  { value: "status",         label: "Estado" },
  { value: "title",          label: "Título" },
  { value: "project",        label: "Proyecto" },
  { value: "assignedTo",     label: "Responsable" },
  { value: "startDate",      label: "Inicio" },
  { value: "estimatedHours", label: "Horas estimadas" },
  { value: "createdAt",      label: "Creación" },
];

type Project = { id: string; name: string };
type Staff   = { id: string; name: string };

export function TaskFilters({
  projects,
  staff,
  showAssignee,
}: {
  projects: Project[];
  staff: Staff[];
  showAssignee: boolean;
}) {
  const filters = useUrlFilters({ clearSentinel: true });

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar tareas..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="dueDate" defaultSortDir="asc" />}
    >
      <FilterField label="Estado">
        <FilterMulti filters={filters} param="status" options={STATUS_OPTIONS} placeholder="Todos" />
      </FilterField>
      <FilterField label="Prioridad">
        <FilterMulti filters={filters} param="priority" options={PRIORITY_OPTIONS} placeholder="Todas" />
      </FilterField>
      <FilterField label="Proyecto">
        <FilterMulti
          filters={filters}
          param="projectId"
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
          placeholder="Todos"
        />
      </FilterField>
      {showAssignee && (
        <FilterField label="Responsable">
          <FilterMulti
            filters={filters}
            param="assignedToId"
            options={staff.map((u) => ({ value: u.id, label: u.name }))}
            placeholder="Todos"
          />
        </FilterField>
      )}
    </FilterBar>
  );
}
