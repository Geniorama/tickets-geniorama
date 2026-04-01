"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { MultiSelect } from "@/components/ui/multi-select";

interface FilterOption { id: string; name: string; }

const STATUS_OPTIONS = [
  { value: "POR_ASIGNAR", label: "Por asignar" },
  { value: "ABIERTO",     label: "Abierto" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "CERRADO",     label: "Cerrado" },
];

export function TicketFilters({
  collaborators,
  creators,
  companies,
  current,
}: {
  collaborators: FilterOption[];
  creators: FilterOption[];
  companies: FilterOption[];
  current: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [form, setForm] = useState({
    createdFrom:  current.createdFrom  ?? "",
    createdTo:    current.createdTo    ?? "",
    updatedFrom:  current.updatedFrom  ?? "",
    updatedTo:    current.updatedTo    ?? "",
    status:       current.status?.split(",").filter(Boolean)       ?? [] as string[],
    assignedToId: current.assignedToId?.split(",").filter(Boolean) ?? [] as string[],
    createdById:  current.createdById?.split(",").filter(Boolean)  ?? [] as string[],
    companyId:    current.companyId?.split(",").filter(Boolean)    ?? [] as string[],
  });

  const hasFilters = Object.values(form).some((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v)
  );
  const filterCount = Object.values(form).filter((v) =>
    Array.isArray(v) ? v.length > 0 : Boolean(v)
  ).length;

  const [open, setOpen] = useState(hasFilters);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (form.createdFrom)          params.set("createdFrom",  form.createdFrom);
    if (form.createdTo)            params.set("createdTo",    form.createdTo);
    if (form.updatedFrom)          params.set("updatedFrom",  form.updatedFrom);
    if (form.updatedTo)            params.set("updatedTo",    form.updatedTo);
    if (form.status.length)        params.set("status",       form.status.join(","));
    if (form.assignedToId.length)  params.set("assignedToId", form.assignedToId.join(","));
    if (form.createdById.length)   params.set("createdById",  form.createdById.join(","));
    if (form.companyId.length)     params.set("companyId",    form.companyId.join(","));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleClear() {
    setForm({
      createdFrom: "", createdTo: "", updatedFrom: "", updatedTo: "",
      status: [], assignedToId: [], createdById: [], companyId: [],
    });
    router.push(pathname);
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const multiTriggerClass =
    "w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer";

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-4">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-t-xl"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filtros
          {hasFilters && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {filterCount}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Collapsible body */}
      {open && (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado desde</label>
              <input
                type="date"
                value={form.createdFrom}
                onChange={(e) => setField("createdFrom", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado hasta</label>
              <input
                type="date"
                value={form.createdTo}
                onChange={(e) => setField("createdTo", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Actualizado desde</label>
              <input
                type="date"
                value={form.updatedFrom}
                onChange={(e) => setField("updatedFrom", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Actualizado hasta</label>
              <input
                type="date"
                value={form.updatedTo}
                onChange={(e) => setField("updatedTo", e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Asignado a</label>
              <MultiSelect
                options={collaborators.map((c) => ({ value: c.id, label: c.name }))}
                value={form.assignedToId}
                onChange={(v) => setField("assignedToId", v)}
                placeholder="Todos"
                triggerClassName={multiTriggerClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado por</label>
              <MultiSelect
                options={creators.map((c) => ({ value: c.id, label: c.name }))}
                value={form.createdById}
                onChange={(v) => setField("createdById", v)}
                placeholder="Todos"
                triggerClassName={multiTriggerClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
              <MultiSelect
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(v) => setField("status", v)}
                placeholder="Todos"
                triggerClassName={multiTriggerClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
              <MultiSelect
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
                value={form.companyId}
                onChange={(v) => setField("companyId", v)}
                placeholder="Todas"
                triggerClassName={multiTriggerClass}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {hasFilters && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                Limpiar filtros
              </button>
            )}
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Aplicar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
