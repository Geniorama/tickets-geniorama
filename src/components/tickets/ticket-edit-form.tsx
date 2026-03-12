"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateTicket } from "@/actions/ticket.actions";

interface Collaborator { id: string; name: string; email: string; role: string; }
interface Client { id: string; name: string; companies: { id: string; name: string }[]; }
interface Plan { id: string; name: string; type: string; companyId: string; company: { name: string }; }
interface Site { id: string; name: string; domain: string; companyId: string; }
interface Ticket {
  id: string; title: string; description: string;
  status: string; priority: string; category: string | null;
  assignedToId: string | null; clientId: string | null; planId: string | null; siteId: string | null;
}

export function TicketEditForm({
  ticket,
  collaborators,
  clients,
  plans,
  sites = [],
}: {
  ticket: Ticket;
  collaborators: Collaborator[];
  clients: Client[];
  plans: Plan[];
  sites?: Site[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(ticket.clientId ?? "");

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const availablePlans = selectedClient
    ? plans.filter((p) => selectedClient.companies.some((co) => co.id === p.companyId))
    : [];
  const availableSites = selectedClientId && selectedClient
    ? sites.filter((s) => selectedClient.companies.some((co) => co.id === s.companyId))
    : sites;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await updateTicket(ticket.id, formData);
      if (result?.error) setError(result.error);
      else router.push(`/tickets/${ticket.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input name="title" required defaultValue={ticket.title} className={inputClass} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea name="description" required rows={5} defaultValue={ticket.description} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="status" defaultValue={ticket.status} className={inputClass}>
            <option value="ABIERTO">Abierto</option>
            <option value="EN_PROGRESO">En progreso</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="CERRADO">Cerrado</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
          <select name="priority" defaultValue={ticket.priority} className={inputClass}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select name="category" defaultValue={ticket.category ?? ""} className={inputClass}>
            <option value="">Sin categoría</option>
            <option value="Soporte técnico">Soporte técnico</option>
            <option value="Facturación">Facturación</option>
            <option value="Desarrollo">Desarrollo</option>
            <option value="Diseño">Diseño</option>
            <option value="Consultoría">Consultoría</option>
            <option value="Hosting">Hosting</option>
            <option value="Dominio">Dominio</option>
            <option value="Correos">Correos</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Asignado a</label>
          <select name="assignedToId" defaultValue={ticket.assignedToId ?? ""} className={inputClass}>
            <option value="">Sin asignar</option>
            {collaborators.map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
            ))}
          </select>
        </div>
      </div>

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
        <select
          name="planId"
          defaultValue={ticket.planId ?? ""}
          className={inputClass}
          disabled={!selectedClientId}
        >
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

      {sites.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sitio / app afectado <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            name="siteId"
            defaultValue={ticket.siteId ?? ""}
            className={inputClass}
            disabled={!selectedClientId}
          >
            <option value="">Sin sitio vinculado</option>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {s.domain}</option>
            ))}
          </select>
          {!selectedClientId && (
            <p className="text-xs text-gray-400 mt-1">Selecciona un cliente para ver sus sitios.</p>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors">
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
