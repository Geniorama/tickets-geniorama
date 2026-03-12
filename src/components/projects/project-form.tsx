"use client";

import { useState, useTransition } from "react";
import { createProject, updateProject } from "@/actions/project.actions";
import type { Project } from "@/generated/prisma";
import { MarkdownEditor } from "@/components/ui/markdown-editor";

interface Company {
  id: string;
  name: string;
}

interface StaffUser {
  id: string;
  name: string;
}

interface ProjectFormProps {
  companies: Company[];
  staffUsers: StaffUser[];
  project?: Project;
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

export function ProjectForm({ companies, staffUsers, project }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!project;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = isEdit
        ? await updateProject(project.id, formData)
        : await createProject(formData);
      if (result?.error) setError(result.error);
    });
  }

  const toInputDate = (d: Date | null | undefined) => {
    if (!d) return "";
    const dt = new Date(d);
    return dt.toISOString().split("T")[0];
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>Nombre del proyecto</label>
        <input
          name="name"
          required
          defaultValue={project?.name ?? ""}
          placeholder="Nombre descriptivo del proyecto"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Descripción</label>
        <MarkdownEditor
          name="description"
          defaultValue={project?.description ?? ""}
          placeholder="Describe el proyecto..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Estado</label>
          <select name="status" defaultValue={project?.status ?? "PLANIFICACION"} style={inputStyle}>
            <option value="PLANIFICACION">Planificación</option>
            <option value="EN_DESARROLLO">En desarrollo</option>
            <option value="EN_REVISION">En revisión</option>
            <option value="COMPLETADO">Completado</option>
            <option value="PAUSADO">Pausado</option>
          </select>
        </div>

        <div>
          <label style={labelStyle}>Empresa</label>
          <select name="companyId" defaultValue={project?.companyId ?? ""} style={inputStyle}>
            <option value="">Sin empresa</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Responsable (manager)</label>
        <select name="managerId" defaultValue={project?.managerId ?? ""} style={inputStyle}>
          <option value="">Sin responsable</option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Fecha de inicio</label>
          <input
            name="startDate"
            type="date"
            defaultValue={toInputDate(project?.startDate)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Fecha límite</label>
          <input
            name="dueDate"
            type="date"
            defaultValue={toInputDate(project?.dueDate)}
            style={inputStyle}
          />
        </div>
      </div>

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

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
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
            : "Crear proyecto"}
        </button>
      </div>
    </form>
  );
}
