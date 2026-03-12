"use client";

import { useState, useTransition, useRef } from "react";
import { Paperclip, Link2, X, Plus, FileText } from "lucide-react";
import { createTask, updateTask } from "@/actions/task.actions";
import type { TaskConflict } from "@/actions/task.actions";
import type { Task } from "@/generated/prisma";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

interface StaffUser {
  id: string;
  name: string;
}

interface TaskFormProps {
  projectId: string;
  staffUsers: StaffUser[];
  task?: Task;
}

interface LinkEntry {
  url: string;
  label: string;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TaskForm({ projectId, staffUsers, task }: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<TaskConflict[] | null>(null);
  const savedFormData = useRef<FormData | null>(null);
  const isEdit = !!task;

  // Attachment state (only for create)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<LinkEntry[]>([]);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toInputDate = (d: Date | null | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(e.target.files ?? []);
    setSelectedFiles((prev) => [...prev, ...incoming]);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function addLink() {
    setLinkError(null);
    const url = linkUrl.trim();
    if (!url) return;
    try {
      new URL(url.startsWith("http") ? url : `https://${url}`);
    } catch {
      setLinkError("URL inválida");
      return;
    }
    const normalized = url.startsWith("http") ? url : `https://${url}`;
    setLinks((prev) => [...prev, { url: normalized, label: linkLabel.trim() || normalized }]);
    setLinkUrl("");
    setLinkLabel("");
  }

  function removeLink(idx: number) {
    setLinks((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleLinkKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addLink();
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConflicts(null);
    const formData = new FormData(e.currentTarget);
    if (!isEdit) {
      formData.delete("files");
      for (const file of selectedFiles) formData.append("files", file);
      formData.set("links", JSON.stringify(links));
    }
    savedFormData.current = formData;
    submit(formData);
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = isEdit
        ? await updateTask(task.id, projectId, formData)
        : await createTask(projectId, formData);
      if (result?.error) setError(result.error);
      if (result?.conflicts) setConflicts(result.conflicts);
    });
  }

  function handleForce() {
    if (!savedFormData.current) return;
    setConflicts(null);
    const fd = savedFormData.current;
    fd.set("force", "true");
    submit(fd);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>Título</label>
        <input
          name="title"
          required
          defaultValue={task?.title ?? ""}
          placeholder="Título de la tarea"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descripción</label>
        <MarkdownEditor
          name="description"
          defaultValue={task?.description ?? ""}
          placeholder="Describe la tarea en detalle..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select name="status" defaultValue={task?.status ?? "PENDIENTE"} style={inputStyle}>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_PROGRESO">En progreso</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Prioridad</label>
          <select name="priority" defaultValue={task?.priority ?? "MEDIA"} style={inputStyle}>
            <option value="BAJA">Baja</option>
            <option value="MEDIA">Media</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Categoría</label>
          <select name="category" defaultValue={task?.category ?? ""} style={inputStyle}>
            <option value="">Sin categoría</option>
            <option value="Frontend">Frontend</option>
            <option value="Backend">Backend</option>
            <option value="Diseño">Diseño</option>
            <option value="Base de datos">Base de datos</option>
            <option value="DevOps">DevOps</option>
            <option value="QA">QA</option>
            <option value="Documentación">Documentación</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Asignado a</label>
          <select name="assignedToId" defaultValue={task?.assignedToId ?? ""} style={inputStyle}>
            <option value="">Sin asignar</option>
            {staffUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Fecha inicio</label>
          <input
            name="startDate"
            type="date"
            defaultValue={toInputDate(task?.startDate)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Fecha límite</label>
          <input
            name="dueDate"
            type="date"
            defaultValue={toInputDate(task?.dueDate)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Horas estimadas</label>
          <input
            name="estimatedHours"
            type="number"
            min="0"
            step="0.5"
            defaultValue={task?.estimatedHours ?? ""}
            placeholder="0"
            style={inputStyle}
          />
        </div>
      </div>

      {/* ── Adjuntos (solo en creación) ── */}
      {!isEdit && (
        <div
          style={{
            border: "1px solid var(--app-border)",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
            Adjuntos <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
          </p>

          {/* ── Archivos ── */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
              Archivos
            </p>

            {/* Archivo oculto */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />

            {/* Botón estilizado */}
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
              Imágenes, PDF o Word · máx. 10 MB por archivo · puedes agregar varios uno a uno
            </p>

            {/* Lista de archivos seleccionados */}
            {selectedFiles.length > 0 && (
              <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
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
                      onClick={() => removeFile(idx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.125rem",
                        color: "var(--app-text-muted)",
                        flexShrink: 0,
                      }}
                      aria-label="Quitar archivo"
                    >
                      <X style={{ width: "0.875rem", height: "0.875rem" }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Divider ── */}
          <div style={{ borderTop: "1px solid var(--app-border)" }} />

          {/* ── Enlaces ── */}
          <div>
            <p style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
              Enlaces
            </p>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => { setLinkUrl(e.target.value); setLinkError(null); }}
                  onKeyDown={handleLinkKeyDown}
                  placeholder="https://ejemplo.com"
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={linkLabel}
                  onChange={(e) => setLinkLabel(e.target.value)}
                  onKeyDown={handleLinkKeyDown}
                  placeholder="Etiqueta (opcional)"
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <button
                type="button"
                onClick={addLink}
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
                }}
              >
                <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
                Agregar
              </button>
            </div>

            {linkError && (
              <p style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.25rem" }}>{linkError}</p>
            )}

            {/* Lista de enlaces */}
            {links.length > 0 && (
              <ul style={{ listStyle: "none", margin: "0.5rem 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {links.map((link, idx) => (
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
                    <Link2 style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--app-body-text)" }}>
                      {link.label}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "12rem" }}>
                      {link.url}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLink(idx)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.125rem",
                        color: "var(--app-text-muted)",
                        flexShrink: 0,
                      }}
                      aria-label="Quitar enlace"
                    >
                      <X style={{ width: "0.875rem", height: "0.875rem" }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && (
        <p
          style={{
            fontSize: "0.875rem",
            color: "#b91c1c",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            padding: "0.625rem 0.75rem",
          }}
        >
          {error}
        </p>
      )}

      {conflicts && conflicts.length > 0 && (
        <div
          style={{
            backgroundColor: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "0.5rem",
            padding: "0.875rem 1rem",
          }}
        >
          <p
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#92400e",
              marginBottom: "0.5rem",
            }}
          >
            ⚠️ El usuario ya tiene tareas asignadas en ese período:
          </p>
          <ul style={{ margin: "0 0 0.75rem 1rem", padding: 0, listStyle: "disc" }}>
            {conflicts.map((c) => (
              <li key={c.taskId} style={{ fontSize: "0.8125rem", color: "#78350f", marginBottom: "0.25rem" }}>
                <strong>{c.taskTitle}</strong> — {c.projectName}
                {(c.startDate || c.dueDate) && (
                  <span style={{ color: "#92400e" }}>
                    {" "}({c.startDate ?? "?"} → {c.dueDate ?? "?"})
                  </span>
                )}
              </li>
            ))}
          </ul>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleForce}
              disabled={isPending}
              style={{
                backgroundColor: "#f59e0b",
                color: "#ffffff",
                padding: "0.375rem 0.875rem",
                borderRadius: "0.5rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Guardar de todos modos
            </button>
            <button
              type="button"
              onClick={() => setConflicts(null)}
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.8125rem",
                color: "#92400e",
                background: "none",
                border: "1px solid #fcd34d",
                borderRadius: "0.5rem",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "0.75rem",
          paddingTop: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => history.back()}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            color: "var(--app-text-muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            backgroundColor: "#fd1384",
            color: "#ffffff",
            padding: "0.5rem 1.25rem",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            border: "none",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending
            ? isEdit
              ? "Guardando..."
              : "Creando..."
            : isEdit
            ? "Guardar cambios"
            : "Crear tarea"}
        </button>
      </div>
    </form>
  );
}
