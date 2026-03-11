"use client";

import { useState, useTransition, useRef } from "react";
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

export function TaskForm({ projectId, staffUsers, task }: TaskFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<TaskConflict[] | null>(null);
  const savedFormData = useRef<FormData | null>(null);
  const isEdit = !!task;

  const toInputDate = (d: Date | null | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setConflicts(null);
    const formData = new FormData(e.currentTarget);
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

      {!isEdit && (
        <div>
          <label style={labelStyle}>
            Archivos adjuntos{" "}
            <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>
              (opcional)
            </span>
          </label>
          <input
            type="file"
            name="files"
            multiple
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            style={{
              width: "100%",
              fontSize: "0.875rem",
              color: "var(--app-text-muted)",
            }}
          />
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Imágenes, PDF o documentos Word. Máx. 10 MB por archivo.
          </p>
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
