"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Project, ProjectStatus, Task, TaskStatus, Priority } from "@/generated/prisma";
import { ProjectStatusBadge } from "./project-status-badge";
import { TaskList } from "./task-list";
import { TaskKanban } from "./task-kanban";
import { TaskCalendar } from "./task-calendar";
import { formatDate } from "@/lib/format-date";
import { Plus, Pencil, List, LayoutGrid, CalendarDays, User2, Building2, Calendar } from "lucide-react";
import { deleteProject } from "@/actions/project.actions";

type TaskWithRelations = Task & {
  assignedTo: { name: string } | null;
  createdBy: { name: string };
  project: { id: string; name: string };
  _count: { comments: number };
};

type ProjectWithDetails = Project & {
  company: { name: string } | null;
  manager: { name: string } | null;
  createdBy: { name: string };
  tasks: TaskWithRelations[];
};

type ViewType = "lista" | "kanban" | "calendario";

export function ProjectDetail({
  project,
  view,
  isAdmin,
  isStaff,
  isClient,
}: {
  project: ProjectWithDetails;
  view: ViewType;
  isAdmin: boolean;
  isStaff: boolean;
  isClient: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleDeleteProject() {
    if (!confirm(`¿Eliminar el proyecto "${project.name}"? Se eliminarán también todas sus tareas. Esta acción no se puede deshacer.`)) return;
    startTransition(() => deleteProject(project.id));
  }

  function setView(v: ViewType) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.push(`?${params.toString()}`);
  }

  const viewButtons: { id: ViewType; label: string; icon: React.ElementType }[] = [
    { id: "lista", label: "Lista", icon: List },
    { id: "kanban", label: "Kanban", icon: LayoutGrid },
    { id: "calendario", label: "Calendario", icon: CalendarDays },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.25rem 1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "1rem",
            marginBottom: "0.75rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.375rem",
                fontWeight: 700,
                color: "var(--app-body-text)",
                marginBottom: "0.25rem",
              }}
            >
              {project.name}
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--app-text-muted)",
                maxWidth: "42rem",
              }}
            >
              {project.description}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <ProjectStatusBadge status={project.status as ProjectStatus} />
            {isAdmin && (
              <>
                <Link
                  href={`/proyectos/${project.id}/edit`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.8125rem",
                    color: "#fd1384",
                    border: "1px solid rgba(253,19,132,0.3)",
                    borderRadius: "0.375rem",
                    padding: "0.25rem 0.625rem",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
                  Editar
                </Link>
                <button
                  onClick={handleDeleteProject}
                  disabled={isPending}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: "0.8125rem",
                    color: "#dc2626",
                    background: "none",
                    border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: "0.375rem",
                    padding: "0.25rem 0.625rem",
                    cursor: isPending ? "not-allowed" : "pointer",
                    opacity: isPending ? 0.6 : 1,
                    fontWeight: 500,
                  }}
                >
                  {isPending ? "Eliminando…" : "Eliminar"}
                </button>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem 1.5rem",
            fontSize: "0.75rem",
            color: "var(--app-text-muted)",
          }}
        >
          {project.company && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Building2 style={{ width: "0.75rem", height: "0.75rem" }} />
              {project.company.name}
            </span>
          )}
          {project.manager && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <User2 style={{ width: "0.75rem", height: "0.75rem" }} />
              Responsable: {project.manager.name}
            </span>
          )}
          {project.startDate && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Calendar style={{ width: "0.75rem", height: "0.75rem" }} />
              Inicio: {formatDate(project.startDate)}
            </span>
          )}
          {project.dueDate && (
            <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Calendar style={{ width: "0.75rem", height: "0.75rem" }} />
              Vence: {formatDate(project.dueDate)}
            </span>
          )}
          {!isClient && (
            <span>
              {project.tasks.length} tarea{project.tasks.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* View toggle + actions — solo para staff/admin */}
      {!isClient && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1rem",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "0.25rem",
                backgroundColor: "var(--app-card-bg)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                padding: "0.25rem",
              }}
            >
              {viewButtons.map((btn) => {
                const Icon = btn.icon;
                const active = view === btn.id;
                return (
                  <button
                    key={btn.id}
                    onClick={() => setView(btn.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.375rem",
                      padding: "0.375rem 0.75rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.8125rem",
                      fontWeight: active ? 600 : 400,
                      border: "none",
                      cursor: "pointer",
                      backgroundColor: active ? "#fd1384" : "transparent",
                      color: active ? "#ffffff" : "var(--app-text-muted)",
                      transition: "all 0.15s",
                    }}
                  >
                    <Icon style={{ width: "0.875rem", height: "0.875rem" }} />
                    {btn.label}
                  </button>
                );
              })}
            </div>

            {isStaff && (
              <Link
                href={`/proyectos/${project.id}/tareas/new`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "#fd1384",
                  color: "#ffffff",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                <Plus style={{ width: "1rem", height: "1rem" }} />
                Nueva tarea
              </Link>
            )}
          </div>

          {view === "lista" && (
            <TaskList tasks={project.tasks} projectId={project.id} />
          )}
          {view === "kanban" && (
            <TaskKanban tasks={project.tasks} projectId={project.id} />
          )}
          {view === "calendario" && (
            <TaskCalendar tasks={project.tasks} projectId={project.id} />
          )}
        </>
      )}
    </div>
  );
}
