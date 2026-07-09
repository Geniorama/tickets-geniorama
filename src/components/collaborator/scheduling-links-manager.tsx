"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import {
  createSchedulingLink,
  updateSchedulingLink,
  deleteSchedulingLink,
} from "@/actions/collaborator.actions";
import {
  SCHEDULING_CATEGORIES,
  SCHEDULING_CATEGORY_LABELS,
  type SchedulingCategory,
  type SchedulingLinkData,
} from "@/lib/scheduling";

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
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--app-body-text)",
  marginBottom: "0.25rem",
};

interface FormValues {
  title: string;
  description: string;
  url: string;
  category: SchedulingCategory;
}

function LinkForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  isPending,
  error,
}: {
  initial: FormValues;
  onSubmit: (values: FormValues) => void;
  onCancel: () => void;
  submitLabel: string;
  isPending: boolean;
  error: string | null;
}) {
  const [values, setValues] = useState<FormValues>(initial);

  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.625rem",
        backgroundColor: "var(--app-bg)",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.625rem" }}>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select
            value={values.category}
            onChange={(e) => setValues((v) => ({ ...v, category: e.target.value as SchedulingCategory }))}
            style={inputStyle}
          >
            {SCHEDULING_CATEGORIES.map((c) => (
              <option key={c} value={c}>{SCHEDULING_CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Título</label>
          <input
            value={values.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
            placeholder="Ej: Reunión de kickoff"
            style={inputStyle}
          />
        </div>
      </div>
      <div>
        <label style={labelStyle}>URL de agendamiento</label>
        <input
          value={values.url}
          onChange={(e) => setValues((v) => ({ ...v, url: e.target.value }))}
          placeholder="https://calendly.com/... o https://calendar.google.com/..."
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Descripción <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span></label>
        <input
          value={values.description}
          onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          placeholder="Ej: Llamada de 30 min para revisar el avance"
          style={inputStyle}
        />
      </div>

      {error && <p style={{ fontSize: "0.75rem", color: "#b91c1c", margin: 0 }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          style={{ padding: "0.4rem 0.875rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", background: "none", border: "1px solid var(--app-border)", borderRadius: "0.5rem", cursor: "pointer" }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => onSubmit(values)}
          disabled={isPending}
          style={{ padding: "0.4rem 0.875rem", fontSize: "0.8125rem", fontWeight: 500, color: "#fff", backgroundColor: "#fd1384", border: "none", borderRadius: "0.5rem", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function SchedulingLinksManager({
  userId,
  links,
}: {
  userId: string;
  links: SchedulingLinkData[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function toFormData(values: FormValues): FormData {
    const fd = new FormData();
    fd.set("title", values.title);
    fd.set("description", values.description);
    fd.set("url", values.url);
    fd.set("category", values.category);
    return fd;
  }

  function handleCreate(values: FormValues) {
    setError(null);
    startTransition(async () => {
      const res = await createSchedulingLink(userId, toFormData(values));
      if (res?.error) { setError(res.error); return; }
      setAdding(false);
      router.refresh();
    });
  }

  function handleUpdate(linkId: string, values: FormValues) {
    setError(null);
    startTransition(async () => {
      const res = await updateSchedulingLink(linkId, toFormData(values));
      if (res?.error) { setError(res.error); return; }
      setEditingId(null);
      router.refresh();
    });
  }

  function handleDelete(linkId: string) {
    if (!confirm("¿Eliminar este link de agendamiento?")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSchedulingLink(linkId);
      if (res?.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {SCHEDULING_CATEGORIES.map((category) => {
        const group = links.filter((l) => l.category === category);
        return (
          <div key={category}>
            <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              {SCHEDULING_CATEGORY_LABELS[category]}
            </p>
            {group.length === 0 ? (
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", fontStyle: "italic", margin: 0 }}>
                Sin links en esta categoría.
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {group.map((link) =>
                  editingId === link.id ? (
                    <li key={link.id}>
                      <LinkForm
                        initial={{ title: link.title, description: link.description ?? "", url: link.url, category: link.category }}
                        onSubmit={(v) => handleUpdate(link.id, v)}
                        onCancel={() => { setEditingId(null); setError(null); }}
                        submitLabel="Guardar cambios"
                        isPending={isPending}
                        error={error}
                      />
                    </li>
                  ) : (
                    <li
                      key={link.id}
                      style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", backgroundColor: "var(--app-bg)" }}
                    >
                      <CalendarClock style={{ width: "0.9375rem", height: "0.9375rem", color: "var(--app-text-muted)", flexShrink: 0, marginTop: "0.125rem" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>{link.title}</p>
                        {link.description && (
                          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: "0.125rem 0 0" }}>{link.description}</p>
                        )}
                        <a href={link.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.75rem", color: "#fd1384", textDecoration: "none", marginTop: "0.125rem", wordBreak: "break-all" }}>
                          {link.url}
                          <ExternalLink style={{ width: "0.6875rem", height: "0.6875rem", flexShrink: 0 }} />
                        </a>
                      </div>
                      <button type="button" onClick={() => { setEditingId(link.id); setAdding(false); setError(null); }} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", padding: "0.125rem" }} aria-label="Editar">
                        <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                      </button>
                      <button type="button" onClick={() => handleDelete(link.id)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", padding: "0.125rem" }} aria-label="Eliminar">
                        <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
                      </button>
                    </li>
                  )
                )}
              </ul>
            )}
          </div>
        );
      })}

      {adding ? (
        <LinkForm
          initial={{ title: "", description: "", url: "", category: "PROYECTOS" }}
          onSubmit={handleCreate}
          onCancel={() => { setAdding(false); setError(null); }}
          submitLabel="Agregar link"
          isPending={isPending}
          error={error}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setAdding(true); setEditingId(null); setError(null); }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", alignSelf: "flex-start", fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", background: "transparent", border: "1px solid rgba(253,19,132,0.35)", borderRadius: "0.5rem", padding: "0.5rem 0.875rem", cursor: "pointer" }}
        >
          <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
          Agregar link de agendamiento
        </button>
      )}

      {!adding && editingId === null && error && (
        <p style={{ fontSize: "0.75rem", color: "#b91c1c", margin: 0 }}>{error}</p>
      )}
    </div>
  );
}
