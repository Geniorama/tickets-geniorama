"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  FilterBar, FilterField, FilterMulti, FilterToggle, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

type Staff = { id: string; name: string };

const KIND_OPTIONS = [
  { value: "ticket", label: "Tickets" },
  { value: "task", label: "Tareas" },
];

const PRIORITY_OPTIONS = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "MEDIA", label: "Media" },
  { value: "BAJA", label: "Baja" },
];

const SORT_OPTIONS = [
  { value: "urgency", label: "Urgencia" },
  { value: "dueDate", label: "Fecha límite" },
  { value: "priority", label: "Prioridad" },
  { value: "status", label: "Estado" },
  { value: "title", label: "Título" },
  { value: "code", label: "Código" },
  { value: "kind", label: "Tipo" },
  { value: "assignedTo", label: "Responsable" },
  { value: "updatedAt", label: "Actualización" },
];

export function PanelFilters({ staff }: { staff: Staff[] }) {
  const filters = useUrlFilters({ clearSentinel: true });

  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar en tickets y tareas..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="urgency" defaultSortDir="asc" />}
    >
      <FilterField label="Tipo">
        <FilterMulti filters={filters} param="kind" options={KIND_OPTIONS} placeholder="Tickets y tareas" />
      </FilterField>
      <FilterField label="Prioridad">
        <FilterMulti filters={filters} param="priority" options={PRIORITY_OPTIONS} placeholder="Todas" />
      </FilterField>
      <FilterField label="Responsable">
        <FilterMulti
          filters={filters}
          param="assignedToId"
          options={staff.map((u) => ({ value: u.id, label: u.name }))}
          placeholder="Todos"
        />
      </FilterField>
      <FilterToggle filters={filters} param="overdue" tone="red" icon={AlertTriangle}>
        Solo vencidos
      </FilterToggle>
      <FilterToggle filters={filters} param="done" tone="green" icon={CheckCircle2}>
        Incluir cerradas
      </FilterToggle>
    </FilterBar>
  );
}
