"use client";

import { useState, useTransition } from "react";
import { createTicket } from "@/actions/ticket.actions";

interface Collaborator { id: string; name: string; role: string; }
interface Client { id: string; name: string; companies: { id: string; name: string }[]; }
interface Plan { id: string; name: string; type: string; companyId: string; company: { name: string }; }
interface Site { id: string; name: string; domain: string; companyId: string; }

export function TicketForm({
  collaborators = [],
  clients = [],
  plans = [],
  sites = [],
}: {
  collaborators?: Collaborator[];
  clients?: Client[];
  plans?: Plan[];
  sites?: Site[];
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedClientId, setSelectedClientId] = useState("");

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const availablePlans = selectedClient
    ? plans.filter((p) => selectedClient.companies.some((co) => co.id === p.companyId))
    : [];
  // Filtrar sitios: si hay cliente seleccionado, mostrar solo los de sus empresas;
  // si no hay cliente (o no hay lista de clientes = CLIENTE role), mostrar todos.
  const availableSites = selectedClientId && selectedClient
    ? sites.filter((s) => selectedClient.companies.some((co) => co.id === s.companyId))
    : sites;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => { await createTicket(formData); });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input
          name="title"
          required
          className={inputClass}
          placeholder="Resumen breve del problema"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          name="description"
          required
          rows={5}
          className={inputClass}
          placeholder="Describe el problema en detalle..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
          <select name="priority" defaultValue="MEDIA" className={inputClass}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select name="category" defaultValue="" className={inputClass}>
            <option value="">Sin categoría</option>
            <option value="Soporte técnico">Soporte técnico</option>
            <option value="Facturación">Facturación</option>
            <option value="Desarrollo">Desarrollo</option>
            <option value="Diseño">Diseño</option>
            <option value="Consultoría">Consultoría</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      {collaborators.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
          <select name="assignedToId" defaultValue="" className={inputClass}>
            <option value="">Sin asignar</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {clients.length > 0 && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              name="clientId"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin cliente asignado</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.companies.length > 0 ? ` — ${c.companies.map((co) => co.name).join(", ")}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select name="planId" defaultValue="" className={inputClass} disabled={!selectedClientId}>
              <option value="">Sin plan asignado</option>
              {availablePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"}
                </option>
              ))}
            </select>
            {selectedClientId && availablePlans.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Este cliente no tiene planes activos.</p>
            )}
            {!selectedClientId && (
              <p className="text-xs text-gray-400 mt-1">Selecciona un cliente para ver sus planes.</p>
            )}
          </div>
        </>
      )}

      {sites.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sitio / app afectado <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            name="siteId"
            defaultValue=""
            className={inputClass}
            disabled={clients.length > 0 && !selectedClientId}
          >
            <option value="">Sin sitio vinculado</option>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.domain}
              </option>
            ))}
          </select>
          {clients.length > 0 && !selectedClientId && (
            <p className="text-xs text-gray-400 mt-1">Selecciona un cliente para ver sus sitios.</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Archivos adjuntos <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="file"
          name="files"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
          className="w-full text-sm text-gray-600 bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:text-gray-700 file:bg-gray-50 hover:file:bg-gray-100 cursor-pointer"
        />
        <p className="text-xs text-gray-400 mt-1">Imágenes, PDF o documentos Word. Máx. 10 MB por archivo.</p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? "Creando..." : "Crear ticket"}
        </button>
      </div>
    </form>
  );
}
