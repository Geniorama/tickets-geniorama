"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Plus, X } from "lucide-react";
import { createTicket } from "@/actions/ticket.actions";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [checklistInput, setChecklistInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    if (newFiles.length > 0) setSelectedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }

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

  function addChecklistItem() {
    const t = checklistInput.trim();
    if (!t) return;
    setChecklistItems((prev) => [...prev, t]);
    setChecklistInput("");
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (checklistItems.length > 0) {
      formData.set("checklist", JSON.stringify(checklistItems));
    }
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
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
        <MarkdownEditor
          name="description"
          placeholder="Describe el problema en detalle..."
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
          Archivos adjuntos <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.avi,.pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--app-body-text)",
              backgroundColor: "var(--app-bg)",
              border: "1px dashed var(--app-border)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.875rem",
              cursor: "pointer",
            }}
          >
            <Paperclip style={{ width: "0.875rem", height: "0.875rem" }} />
            Seleccionar archivos
          </button>
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.375rem" }}>
            Imágenes, video, PDF o Word · máx. 10 MB (100 MB para video) · puedes agregar varios uno a uno
          </p>
        </div>

        {selectedFiles.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {selectedFiles.map((file, idx) => (
              <li
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  backgroundColor: "var(--app-bg)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "0.375rem",
                  padding: "0.375rem 0.625rem",
                }}
              >
                <FileText style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--app-body-text)" }}>
                  {file.name}
                </span>
                <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: "0.125rem", color: "var(--app-text-muted)", flexShrink: 0 }}
                  aria-label="Quitar archivo"
                >
                  <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
          Checklist <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
        </label>

        {checklistItems.length > 0 && (
          <ul style={{ listStyle: "none", margin: "0 0 0.5rem", padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {checklistItems.map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.8125rem",
                  backgroundColor: "var(--app-bg)",
                  border: "1px solid var(--app-border)",
                  borderRadius: "0.375rem",
                  padding: "0.375rem 0.625rem",
                }}
              >
                <span style={{ flex: 1, color: "var(--app-body-text)" }}>{item}</span>
                <button
                  type="button"
                  onClick={() => setChecklistItems((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)" }}
                >
                  <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="text"
            value={checklistInput}
            onChange={(e) => setChecklistInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
            placeholder="Agregar ítem al checklist…"
            style={{ flex: 1, border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem", color: "var(--app-body-text)", backgroundColor: "var(--app-bg)", outline: "none", boxSizing: "border-box" }}
          />
          <button
            type="button"
            onClick={addChecklistItem}
            disabled={!checklistInput.trim()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#fd1384",
              backgroundColor: "transparent",
              border: "1px solid rgba(253,19,132,0.35)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
              opacity: checklistInput.trim() ? 1 : 0.4,
            }}
          >
            <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
            Agregar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <option value="Hosting">Hosting</option>
            <option value="Dominio">Dominio</option>
            <option value="Correos">Correos</option>
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
