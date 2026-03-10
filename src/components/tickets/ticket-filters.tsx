"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";

interface FilterOption { id: string; name: string; }

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

  const hasFilters = Object.keys(current).length > 0;
  const [open, setOpen] = useState(hasFilters);

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, value] of data.entries()) {
      if (value) params.set(key, value as string);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleClear() {
    router.push(pathname);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl mb-4 overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filtros
          {hasFilters && (
            <span className="bg-indigo-100 text-indigo-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
              {Object.keys(current).length}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado desde</label>
              <input type="date" name="createdFrom" defaultValue={current.createdFrom ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado hasta</label>
              <input type="date" name="createdTo" defaultValue={current.createdTo ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Actualizado desde</label>
              <input type="date" name="updatedFrom" defaultValue={current.updatedFrom ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Actualizado hasta</label>
              <input type="date" name="updatedTo" defaultValue={current.updatedTo ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Asignado a</label>
              <select name="assignedToId" defaultValue={current.assignedToId ?? ""} className={inputClass}>
                <option value="">Todos</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Creado por</label>
              <select name="createdById" defaultValue={current.createdById ?? ""} className={inputClass}>
                <option value="">Todos</option>
                {creators.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Empresa</label>
              <select name="companyId" defaultValue={current.companyId ?? ""} className={inputClass}>
                <option value="">Todas</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
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
