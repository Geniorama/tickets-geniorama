"use client";

import { useState, useTransition } from "react";
import { createProject, updateProject } from "@/actions/project.actions";
import type { Project } from "@/generated/prisma";
import { MarkdownEditor } from "@/components/ui/markdown-editor";
import { Lock, Globe, X } from "lucide-react";

interface Company { id: string; name: string; }
interface StaffUser { id: string; name: string; }
interface AllUser { id: string; name: string; role: string; }

interface ProjectFormProps {
  companies: Company[];
  staffUsers: StaffUser[];
  allUsers?: AllUser[];
  project?: Project & { members?: { userId: string }[] };
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

export function ProjectForm({ companies, staffUsers, allUsers = [], project }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!project;

  const [isPrivate, setIsPrivate] = useState(project?.isPrivate ?? false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(
    project?.members?.map((m) => m.userId) ?? []
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("isPrivate", isPrivate ? "true" : "false");
    // Replace memberIds with current state
    formData.delete("memberIds");
    for (const id of selectedMemberIds) formData.append("memberIds", id);

    startTransition(async () => {
      const result = isEdit
        ? await updateProject(project.id, formData)
        : await createProject(formData);
      if (result?.error) setError(result.error);
    });
  }

  const toInputDate = (d: Date | null | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  function addMember(userId: string) {
    if (!userId || selectedMemberIds.includes(userId)) return;
    setSelectedMemberIds((prev) => [...prev, userId]);
  }

  function removeMember(userId: string) {
    setSelectedMemberIds((prev) => prev.filter((id) => id !== userId));
  }

  const selectedMembers = allUsers.filter((u) => selectedMemberIds.includes(u.id));
  const availableToAdd = allUsers.filter((u) => !selectedMemberIds.includes(u.id));

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
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Responsable (manager)</label>
        <select name="managerId" defaultValue={project?.managerId ?? ""} style={inputStyle}>
          <option value="">Sin responsable</option>
          {staffUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Fecha de inicio</label>
          <input name="startDate" type="date" defaultValue={toInputDate(project?.startDate)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Fecha límite</label>
          <input name="dueDate" type="date" defaultValue={toInputDate(project?.dueDate)} style={inputStyle} />
        </div>
      </div>

      {/* Visibilidad */}
      <div
        style={{
          border: "1px solid var(--app-border)",
          borderRadius: "0.625rem",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <button
            type="button"
            onClick={() => setIsPrivate(false)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              borderRight: "1px solid var(--app-border)",
              cursor: "pointer",
              backgroundColor: !isPrivate ? "var(--app-content-bg)" : "var(--app-card-bg)",
              color: !isPrivate ? "var(--app-body-text)" : "var(--app-text-muted)",
              transition: "background 0.15s",
            }}
          >
            <Globe style={{ width: "1rem", height: "1rem" }} />
            Público
          </button>
          <button
            type="button"
            onClick={() => setIsPrivate(true)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              backgroundColor: isPrivate ? "#fdf4ff" : "var(--app-card-bg)",
              color: isPrivate ? "#7c3aed" : "var(--app-text-muted)",
              transition: "background 0.15s",
            }}
          >
            <Lock style={{ width: "1rem", height: "1rem" }} />
            Privado
          </button>
        </div>

        {isPrivate && (
          <div
            style={{
              borderTop: "1px solid var(--app-border)",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              backgroundColor: "#fdf4ff",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#7c3aed" }}>
              Solo los usuarios seleccionados podrán ver este proyecto. Los administradores siempre tienen acceso.
            </p>

            {allUsers.length > 0 && (
              <div>
                <label style={{ ...labelStyle, color: "#7c3aed" }}>Agregar usuario</label>
                <select
                  style={{ ...inputStyle, borderColor: "#c4b5fd" }}
                  value=""
                  onChange={(e) => { addMember(e.target.value); e.target.value = ""; }}
                >
                  <option value="">Seleccionar usuario...</option>
                  {availableToAdd.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role === "ADMINISTRADOR" ? "Admin" : u.role === "COLABORADOR" ? "Colaborador" : "Cliente"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedMembers.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {selectedMembers.map((u) => (
                  <span
                    key={u.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.8125rem",
                      backgroundColor: "#ede9fe",
                      color: "#5b21b6",
                      borderRadius: "9999px",
                      padding: "0.2rem 0.625rem 0.2rem 0.75rem",
                      fontWeight: 500,
                    }}
                  >
                    {u.name}
                    <button
                      type="button"
                      onClick={() => removeMember(u.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", color: "#7c3aed" }}
                    >
                      <X style={{ width: "0.75rem", height: "0.75rem" }} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#a78bfa" }}>
                Sin miembros seleccionados — nadie más podrá ver el proyecto.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button
          type="button"
          onClick={() => history.back()}
          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--app-text-muted)", background: "none", border: "none", cursor: "pointer" }}
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{ backgroundColor: "#fd1384", color: "#ffffff", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}
        >
          {isPending ? (isEdit ? "Guardando..." : "Creando...") : (isEdit ? "Guardar cambios" : "Crear proyecto")}
        </button>
      </div>
    </form>
  );
}
