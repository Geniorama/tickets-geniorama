"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { parseChecklistPaste } from "@/lib/checklist-paste";
import { createTicketTemplate, updateTicketTemplate } from "@/actions/ticket-template.actions";

export interface TicketTemplateData {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  category: string | null;
  checklist: string[];
}

const TICKET_CATEGORIES = [
  "Soporte técnico",
  "Facturación",
  "Desarrollo",
  "Diseño",
  "Consultoría",
  "Hosting",
  "Dominio",
  "Correos",
  "Otro",
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--app-body-text)",
  marginBottom: "0.25rem",
};

export function TicketTemplateForm({ template }: { template?: TicketTemplateData }) {
  const router = useRouter();
  const isEdit = !!template;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<string[]>(template?.checklist ?? []);
  const [checklistInput, setChecklistInput] = useState("");

  function addChecklistItem() {
    const t = checklistInput.trim();
    if (!t) return;
    setChecklist((prev) => [...prev, t]);
    setChecklistInput("");
  }

  function handleChecklistPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const items = parseChecklistPaste(e.clipboardData.getData("text"));
    if (items.length > 1) {
      e.preventDefault();
      setChecklist((prev) => [...prev, ...items]);
      setChecklistInput("");
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("checklist", JSON.stringify(checklist));
    startTransition(async () => {
      const res = isEdit
        ? await updateTicketTemplate(template.id, formData)
        : await createTicketTemplate(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>Nombre de la plantilla</label>
        <input
          name="name"
          required
          defaultValue={template?.name ?? ""}
          placeholder="Ej: Caída del sitio, Solicitud de cambio, Soporte de correo..."
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Título del ticket</label>
        <input
          name="title"
          required
          defaultValue={template?.title ?? ""}
          placeholder="Título que tendrá el ticket creado"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descripción</label>
        <MarkdownEditor
          name="description"
          defaultValue={template?.description ?? ""}
          placeholder="Describe el problema o solicitud..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Prioridad</label>
          <select name="priority" defaultValue={template?.priority ?? "MEDIA"} style={inputStyle}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select name="category" defaultValue={template?.category ?? ""} style={inputStyle}>
            <option value="">Sin categoría</option>
            {template?.category && !TICKET_CATEGORIES.includes(template.category) && (
              <option value={template.category}>{template.category}</option>
            )}
            {TICKET_CATEGORIES.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Checklist */}
      <div>
        <label style={labelStyle}>
          Checklist <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
        </label>
        {checklist.length > 0 && (
          <ul style={{ listStyle: "none", margin: "0 0 0.5rem", padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {checklist.map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem",
                  border: "1px solid var(--app-border)", borderRadius: "0.375rem", padding: "0.375rem 0.625rem",
                  color: "var(--app-body-text)",
                }}
              >
                <span style={{ flex: 1 }}>{item}</span>
                <button
                  type="button"
                  onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== idx))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", display: "flex" }}
                >
                  <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={checklistInput}
            onChange={(e) => setChecklistInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChecklistItem(); } }}
            onPaste={handleChecklistPaste}
            placeholder="Agregar ítem y pulsar Enter"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={addChecklistItem}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.25rem", padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)",
              color: "var(--app-body-text)", fontSize: "0.8125rem", cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            <Plus style={{ width: "0.875rem", height: "0.875rem" }} /> Agregar
          </button>
        </div>
      </div>

      {error && (
        <p style={{ fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button type="button" onClick={() => router.push("/tickets/plantillas")}
          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--app-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          style={{ backgroundColor: "#fd1384", color: "#fff", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear plantilla"}
        </button>
      </div>
    </form>
  );
}
