"use client";

import { UserCheck } from "lucide-react";
import {
  FilterBar, FilterToggle, SortSelect, useUrlFilters,
} from "@/components/ui/filter-kit";
import { SearchInput } from "@/components/ui/search-input";

const SORT_OPTIONS = [
  { value: "company",   label: "Empresa" },
  { value: "name",      label: "Nombre" },
  { value: "createdAt", label: "Creación" },
];

export function ContactFilters() {
  const filters = useUrlFilters();
  return (
    <FilterBar
      search={<SearchInput placeholder="Buscar por nombre, correo o empresa..." />}
      sort={<SortSelect options={SORT_OPTIONS} defaultSortBy="company" defaultSortDir="asc" />}
    >
      <FilterToggle filters={filters} param="portal" tone="green" icon={UserCheck}>
        Solo con portal
      </FilterToggle>
    </FilterBar>
  );
}
