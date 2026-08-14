"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DraftChecklist } from "@/components/ui/draft-checklist";
import type { ChecklistGroup } from "@/lib/checklist";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { TASK_CATEGORY_GROUPS, TASK_CATEGORIES } from "@/lib/task-categories";
import { splitEstimatedHours } from "@/lib/estimated-time";
import { createTaskTemplate, updateTaskTemplate } from "@/actions/task-template.actions";
import { AiTemplateGenerator } from "@/components/ui/ai-template-generator";
import type { TemplateDraft } from "@/actions/template-ai.actions";

export interface TaskTemplateData {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: string;
  category: string | null;
  estimatedHours: number | null;
  checklist: ChecklistGroup[];
}

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

export function TaskTemplateForm({ template }: { template?: TaskTemplateData }) {
  const router = useRouter();
  const isEdit = !!template;
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistGroup[]>(template?.checklist ?? []);
  // Borrador de la IA. Los campos son no controlados, así que al aplicarlo se
  // remontan (`draftKey`) para que tomen los nuevos `defaultValue`.
  const [draft, setDraft] = useState<TemplateDraft | null>(null);
  const [draftKey, setDraftKey] = useState(0);

  const values = {
    name:        draft?.name        ?? template?.name        ?? "",
    title:       draft?.title       ?? template?.title       ?? "",
    description: draft?.description ?? template?.description ?? "",
    priority:    draft?.priority    ?? template?.priority    ?? "MEDIA",
    category:    draft?.category    ?? template?.category    ?? "",
    estimatedHours: draft ? draft.estimatedHours : template?.estimatedHours ?? null,
  };
  const estimatedParts = splitEstimatedHours(values.estimatedHours);

  function applyDraft(next: TemplateDraft) {
    setDraft(next);
    setChecklist(next.checklist);
    setDraftKey((k) => k + 1);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("checklist", JSON.stringify(checklist));
    startTransition(async () => {
      const res = isEdit
        ? await updateTaskTemplate(template.id, formData)
        : await createTaskTemplate(formData);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <AiTemplateGenerator
        kind="TASK"
        onGenerated={applyDraft}
        defaultOpen={!isEdit}
        willReplace={isEdit}
      />

      {/* Se remonta al aplicar un borrador de IA: los campos son no controlados. */}
      <div key={draftKey} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Nombre de la plantilla <span style={{ color: "#b91c1c" }}>*</span></label>
          <input
            name="name"
            required
            defaultValue={values.name}
            placeholder="Ej: Publicación de Instagram, Onboarding cliente..."
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Título de la tarea <span style={{ color: "#b91c1c" }}>*</span></label>
          <input
            name="title"
            required
            defaultValue={values.title}
            placeholder="Título que tendrá la tarea creada"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Descripción <span style={{ color: "#b91c1c" }}>*</span></label>
          <MarkdownEditor
            name="description"
            defaultValue={values.description}
            placeholder="Describe el trabajo a realizar..."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={labelStyle}>Prioridad <span style={{ color: "#b91c1c" }}>*</span></label>
            <select name="priority" defaultValue={values.priority} style={inputStyle}>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Categoría <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span></label>
            <select name="category" defaultValue={values.category} style={inputStyle}>
              <option value="">Sin categoría</option>
              {values.category && !TASK_CATEGORIES.includes(values.category) && (
                <option value={values.category}>{values.category}</option>
              )}
              {TASK_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tiempo estimado <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span></label>
            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
              <input
                name="estimatedHours"
                type="number"
                min="0"
                step="1"
                defaultValue={estimatedParts.hours ?? ""}
                placeholder="0"
                aria-label="Horas estimadas"
                style={{ ...inputStyle, textAlign: "right" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>h</span>
              <input
                name="estimatedMinutes"
                type="number"
                min="0"
                max="59"
                step="1"
                defaultValue={estimatedParts.minutes ?? ""}
                placeholder="0"
                aria-label="Minutos estimados"
                style={{ ...inputStyle, textAlign: "right" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>m</span>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <label style={labelStyle}>
            Checklist <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
          </label>
          <DraftChecklist
            groups={checklist}
            onChange={setChecklist}
            placeholder="Agregar ítem y pulsar Enter"
          />
        </div>
      </div>

      {error && (
        <p style={{ fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button type="button" onClick={() => router.push("/tareas/plantillas")}
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
