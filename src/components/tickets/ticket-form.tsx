"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { createTicket } from "@/actions/ticket.actions";
import { runAction } from "@/lib/run-action";
import { DraftChecklist } from "@/components/ui/draft-checklist";
import type { ChecklistGroup } from "@/lib/checklist";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { MultiSelect } from "@/components/ui/multi-select";
import { vaultOptionLabel } from "@/lib/vault-options";
import { FILE_RULES, formatFileSize, splitFiles } from "@/lib/file-rules";
import { TICKET_CATEGORIES, suggestCategory } from "@/lib/ticket-suggestions";

interface Collaborator { id: string; name: string; role: string; }
interface Company { id: string; name: string; type: string; parentId: string | null; }
interface Client { id: string; name: string; companies: { id: string; name: string }[]; }
interface Plan { id: string; name: string; type: string; companyId: string; company: { name: string }; }
interface Site { id: string; name: string; domain: string; companyId: string; }
interface VaultEntry { id: string; title: string; username: string | null; }

interface TicketPrefill {
  title: string;
  description: string;
  priority: string;
  category: string | null;
  checklist: ChecklistGroup[];
}

export function TicketForm({
  collaborators = [],
  companies = [],
  clients = [],
  plans = [],
  sites = [],
  reviewerCandidates = [],
  vaultEntries = [],
  canSetDueDate = false,
  canSaveDraft = false,
  prefill,
}: {
  collaborators?: Collaborator[];
  /** Solo para el equipo: el ticket se abre dentro de una empresa. */
  companies?: Company[];
  clients?: Client[];
  plans?: Plan[];
  sites?: Site[];
  reviewerCandidates?: { id: string; name: string }[];
  /** Accesos de Bóveda que quien crea puede ver. Vacío para quien no es staff. */
  vaultEntries?: VaultEntry[];
  canSetDueDate?: boolean;
  canSaveDraft?: boolean;
  prefill?: TicketPrefill;
}) {
  const [isPending, startTransition] = useTransition();
  const submitAsDraft = useRef(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [companyId, setCompanyId] = useState("");
  // Un cliente (sin lista de empresas ni de clientes) recibe solo sus planes
  // vigentes: si hay uno, ese; si hay varios, elige.
  const isClientForm = companies.length === 0 && clients.length === 0 && plans.length > 0;
  const [planId, setPlanId] = useState(isClientForm && plans.length === 1 ? plans[0].id : "");
  const [siteId, setSiteId] = useState("");
  const [category, setCategory] = useState(prefill?.category ?? "");
  // true mientras la categoría que se ve la puso la sugerencia y no una persona
  const [categorySuggested, setCategorySuggested] = useState(false);
  const categoryTouched = useRef(!!prefill?.category);
  const [reviewerIds, setReviewerIds] = useState<string[]>([]);
  const [vaultEntryIds, setVaultEntryIds] = useState<string[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistGroup[]>(prefill?.checklist ?? []);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { valid, errors } = splitFiles(Array.from(e.target.files ?? []), FILE_RULES.attachment);
    setFileErrors(errors);
    if (valid.length > 0) setSelectedFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  const inputClass =
    "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500";

  // Con empresas (el equipo), todo se filtra por la empresa elegida. Sin ellas
  // (un cliente), el formulario se comporta como siempre.
  const byCompany = companies.length > 0;
  const selectedClient = clients.find((c) => c.id === selectedClientId);
  const availableClients = byCompany
    ? clients.filter((c) => c.companies.some((co) => co.id === companyId))
    : clients;
  const availablePlans = byCompany
    ? plans.filter((p) => p.companyId === companyId)
    : selectedClient
      ? plans.filter((p) => selectedClient.companies.some((co) => co.id === p.companyId))
      : [];
  const availableSites = byCompany
    ? sites.filter((st) => st.companyId === companyId)
    : selectedClientId && selectedClient
      ? sites.filter((st) => selectedClient.companies.some((co) => co.id === st.companyId))
      : sites;

  // Las empresas en orden de lectura: cada agencia seguida de sus subempresas
  // (Ekon 7 → Asohofrucol). Una subempresa cuya agencia no está activa sale suelta.
  const companyOptions = (() => {
    const ids = new Set(companies.map((c) => c.id));
    const roots = companies.filter((c) => !c.parentId || !ids.has(c.parentId));
    return roots.flatMap((root) => [
      { id: root.id, label: root.name },
      ...companies
        .filter((c) => c.parentId === root.id)
        .map((c) => ({ id: c.id, label: `   ↳ ${c.name} (${root.name})` })),
    ]);
  })();

  /** Al elegir empresa se preselecciona lo que no admite duda: el único cliente, plan o sitio. */
  function handleCompanyChange(id: string) {
    setCompanyId(id);
    const cl = clients.filter((c) => c.companies.some((co) => co.id === id));
    const pl = plans.filter((p) => p.companyId === id);
    const si = sites.filter((st) => st.companyId === id);
    setSelectedClientId(cl.length === 1 ? cl[0].id : "");
    setPlanId(pl.length === 1 ? pl[0].id : "");
    setSiteId(si.length === 1 ? si[0].id : "");
  }

  function handleTitleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (categoryTouched.current) return;
    const suggestion = suggestCategory(e.target.value);
    setCategory(suggestion ?? "");
    setCategorySuggested(!!suggestion);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (byCompany && !companyId && !submitAsDraft.current) {
      submitAsDraft.current = false;
      setSubmitError("Elige la empresa del ticket");
      return;
    }
    if (isClientForm && plans.length > 1 && !planId) {
      setSubmitError("Elige a qué plan se carga este ticket");
      return;
    }
    const formData = new FormData(e.currentTarget);
    if (checklistItems.length > 0) {
      formData.set("checklist", JSON.stringify(checklistItems));
    }
    for (const file of selectedFiles) {
      formData.append("files", file);
    }
    formData.set("isDraft", submitAsDraft.current ? "true" : "false");
    submitAsDraft.current = false;
    setSubmitError(null);
    startTransition(async () => {
      // Si todo va bien la acción redirige al ticket; si vuelve, es con un
      // error, y el formulario se queda tal cual para corregir y reintentar.
      // Los adjuntos pueden pesar mucho: más margen que una acción normal.
      const r = await runAction(() => createTicket(formData), {
        timeoutMs: selectedFiles.length > 0 ? 180_000 : 60_000,
      });
      if (!r.ok) {
        // El servidor pudo terminar aunque la respuesta no llegue: avisar para no duplicar.
        setSubmitError(
          r.timedOut || r.error.startsWith("No hay conexión")
            ? "No hubo respuesta del servidor. Antes de reintentar, revisa en la lista de tickets si ya se creó para no duplicarlo."
            : r.error
        );
        return;
      }
      if (r.data?.error) setSubmitError(r.data.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
        <input
          name="title"
          required
          defaultValue={prefill?.title ?? ""}
          onChange={handleTitleChange}
          className={inputClass}
          placeholder="Resumen breve del problema"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <MarkdownEditor
          name="description"
          defaultValue={prefill?.description ?? ""}
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
          accept={FILE_RULES.attachment.accept}
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
            Imágenes, video, PDF, Word, Excel, PowerPoint o comprimidos · máx. 10 MB (100 MB para video) · puedes seleccionar varios a la vez
          </p>

          {fileErrors.length > 0 && (
            <div style={{ marginTop: "0.375rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--tone-red-bg)", border: "1px solid var(--tone-red-bd)", borderRadius: "0.375rem" }}>
              {fileErrors.map((err, i) => (
                <p key={i} style={{ fontSize: "0.75rem", color: "var(--tone-red-fg)", margin: 0 }}>{err}</p>
              ))}
            </div>
          )}
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

        <DraftChecklist groups={checklistItems} onChange={setChecklistItems} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
          <select name="priority" defaultValue={prefill?.priority ?? "MEDIA"} className={inputClass}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
          <select
            name="category"
            value={category}
            onChange={(e) => {
              categoryTouched.current = true;
              setCategorySuggested(false);
              setCategory(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">Sin categoría</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {categorySuggested && (
            <p className="text-xs text-indigo-600 mt-1">Sugerida por el título; puedes cambiarla.</p>
          )}
        </div>
      </div>

      {canSetDueDate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fecha límite <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input type="date" name="dueDate" defaultValue="" className={inputClass} />
        </div>
      )}

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

      {reviewerCandidates.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Revisores <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <MultiSelect
            options={reviewerCandidates.map((u) => ({ value: u.id, label: u.name }))}
            value={reviewerIds}
            onChange={setReviewerIds}
            placeholder="Por defecto: quien crea el ticket"
            triggerClassName={inputClass}
            searchable
          />
          <input type="hidden" name="reviewerIds" value={reviewerIds.join(",")} />
          <p className="text-xs text-gray-400 mt-1">
            Quienes revisan el ticket cuando pasa a «En revisión». Si lo dejas vacío, será el creador.
          </p>
        </div>
      )}

      {byCompany && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
          <select
            name="companyId"
            value={companyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona la empresa…</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 mt-1">
            Define de quién es el ticket y qué clientes, planes y sitios puedes elegir.
          </p>
        </div>
      )}

      {(byCompany || clients.length > 0) && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            <select
              name="clientId"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className={inputClass}
              disabled={byCompany && !companyId}
            >
              <option value="">Sin cliente asignado</option>
              {availableClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{!byCompany && c.companies.length > 0 ? ` — ${c.companies.map((co) => co.name).join(", ")}` : ""}
                </option>
              ))}
            </select>
            {byCompany && !companyId && (
              <p className="text-xs text-gray-400 mt-1">Selecciona una empresa para ver sus clientes.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <select
              name="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className={inputClass}
              disabled={byCompany ? !companyId : !selectedClientId}
            >
              <option value="">Sin plan asignado</option>
              {availablePlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"}
                </option>
              ))}
            </select>
            {(byCompany ? companyId : selectedClientId) && availablePlans.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                {byCompany ? "Esta empresa no tiene planes activos." : "Este cliente no tiene planes activos."}
              </p>
            )}
            {byCompany && companyId && availablePlans.length > 1 && !planId && (
              <p className="text-xs text-amber-600 mt-1">
                Hay {availablePlans.length} planes: elige a cuál cargar las horas.
              </p>
            )}
            {!(byCompany ? companyId : selectedClientId) && (
              <p className="text-xs text-gray-400 mt-1">
                {byCompany ? "Selecciona una empresa para ver sus planes." : "Selecciona un cliente para ver sus planes."}
              </p>
            )}
          </div>
        </>
      )}

      {isClientForm && plans.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
          <select
            name="planId"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className={inputClass}
          >
            <option value="">Elige un plan…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.type === "BOLSA_HORAS" ? "Bolsa de horas" : "Soporte mensual"}
              </option>
            ))}
          </select>
          {!planId && (
            <p className="text-xs text-amber-600 mt-1">
              Tienes {plans.length} planes vigentes: elige a cuál se cargan las horas de este ticket.
            </p>
          )}
        </div>
      )}

      {sites.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sitio / app afectado <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <select
            name="siteId"
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className={inputClass}
            disabled={byCompany ? !companyId : clients.length > 0 && !selectedClientId}
          >
            <option value="">Sin sitio vinculado</option>
            {availableSites.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} — {st.domain}
              </option>
            ))}
          </select>
          {byCompany ? (
            !companyId && <p className="text-xs text-gray-400 mt-1">Selecciona una empresa para ver sus sitios.</p>
          ) : (
            clients.length > 0 && !selectedClientId && (
              <p className="text-xs text-gray-400 mt-1">Selecciona un cliente para ver sus sitios.</p>
            )
          )}
        </div>
      )}

      {/* La Bóveda al crear y no solo en la ficha: quien abre un ticket de
          «no entra al WordPress» ya tiene delante el acceso del que habla, y
          obligarle a guardar y volver a entrar para vincularlo era la razón de
          que casi ningún ticket lo llevara. */}
      {vaultEntries.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Accesos de Bóveda <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <MultiSelect
            options={vaultEntries.map((e) => ({ value: e.id, label: vaultOptionLabel(e) }))}
            value={vaultEntryIds}
            onChange={setVaultEntryIds}
            placeholder="Sin accesos vinculados"
            triggerClassName={inputClass}
            searchable
          />
          <input type="hidden" name="vaultEntryIds" value={vaultEntryIds.join(",")} />
          <p className="text-xs text-gray-400 mt-1">
            Las credenciales que hacen falta para resolverlo. Solo las ve quien ya
            tiene acceso a ellas en la Bóveda.
          </p>
        </div>
      )}

      {submitError && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {submitError}
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={() => history.back()}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
        >
          Cancelar
        </button>
        {canSaveDraft && (
          <button
            type="submit"
            disabled={isPending}
            onClick={() => { submitAsDraft.current = true; }}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition-colors"
          >
            {isPending ? "Guardando..." : "Guardar como borrador"}
          </button>
        )}
        <button
          type="submit"
          disabled={isPending}
          onClick={() => { submitAsDraft.current = false; }}
          className="bg-accent text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent-dark disabled:opacity-60 transition-colors"
        >
          {isPending ? "Creando..." : "Crear ticket"}
        </button>
      </div>
    </form>
  );
}
