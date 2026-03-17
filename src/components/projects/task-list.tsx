"use client";

import Link from "next/link";
import type { Task, TaskStatus, Priority } from "@/generated/prisma";
import { TaskStatusBadge, TaskPriorityBadge } from "./project-status-badge";
import { formatDate } from "@/lib/format-date";
import { ListTodo } from "lucide-react";
import { SortableHeader } from "@/components/ui/sortable-header";
import { taskCode } from "@/lib/task-code";

type TaskWithRelations = Task & {
  assignedTo: { name: string } | null;
  createdBy: { name: string };
  project: { id: string; name: string };
  _count: { comments: number };
};

// Cuando se pasa projectId se omite la columna "Proyecto" (vista dentro de un proyecto)
// Cuando no se pasa se muestra la columna "Proyecto" (vista global /tareas)
export function TaskList({
  tasks,
  projectId,
  sortBy,
  sortDir,
  basePath,
  paramsStr,
}: {
  tasks: TaskWithRelations[];
  projectId?: string;
  sortBy?: string;
  sortDir?: string;
  basePath?: string;
  paramsStr?: string;
}) {
  const showProject = !projectId;

  if (tasks.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "3rem",
          textAlign: "center",
        }}
      >
        <ListTodo
          style={{
            width: "2.5rem",
            height: "2.5rem",
            color: "var(--app-text-muted)",
            margin: "0 auto 0.75rem",
          }}
        />
        <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          No hay tareas.
        </p>
      </div>
    );
  }

  const plainThStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "0.75rem 1rem",
    color: "var(--app-text-muted)",
    fontWeight: 500,
    fontSize: "0.8125rem",
    whiteSpace: "nowrap",
  };

  const sortable = !!basePath;
  const sb = sortBy ?? "createdAt";
  const sd = sortDir ?? "desc";
  const bp = basePath ?? "";
  const ps = paramsStr ?? "";

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
        <thead>
          <tr
            style={{
              backgroundColor: "var(--app-content-bg)",
              borderBottom: "1px solid var(--app-border)",
            }}
          >
            {sortable ? (
              <SortableHeader label="Título" column="title" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Título</th>
            )}

            {showProject && (
              sortable ? (
                <SortableHeader label="Proyecto" column="project" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
              ) : (
                <th style={plainThStyle}>Proyecto</th>
              )
            )}

            {sortable ? (
              <SortableHeader label="Estado" column="status" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Estado</th>
            )}

            {sortable ? (
              <SortableHeader label="Prioridad" column="priority" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Prioridad</th>
            )}

            <th style={plainThStyle}>Categoría</th>

            {sortable ? (
              <SortableHeader label="Asignado a" column="assignedTo" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Asignado a</th>
            )}

            {sortable ? (
              <SortableHeader label="Inicio" column="startDate" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Inicio</th>
            )}

            {sortable ? (
              <SortableHeader label="Vence" column="dueDate" sortBy={sb} sortDir={sd} basePath={bp} paramsStr={ps} />
            ) : (
              <th style={plainThStyle}>Vence</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task, i) => {
            const href = `/proyectos/${task.project.id}/tareas/${task.id}`;
            return (
              <tr
                key={task.id}
                style={{
                  borderBottom: i < tasks.length - 1 ? "1px solid var(--app-border)" : "none",
                }}
              >
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Link
                    href={href}
                    style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fd1384")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--app-body-text)")}
                  >
                    {task.number > 0 && (
                      <span style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--app-text-muted)", background: "var(--app-content-bg)", border: "1px solid var(--app-border)", borderRadius: "0.25rem", padding: "0.1rem 0.35rem", letterSpacing: "0.03em", flexShrink: 0 }}>
                        {taskCode(task.project.name, task.number)}
                      </span>
                    )}
                    {task.title}
                  </Link>
                  {task._count.comments > 0 && (
                    <span style={{ marginLeft: "0.5rem", fontSize: "0.6875rem", color: "var(--app-text-muted)" }}>
                      {task._count.comments} comentarios
                    </span>
                  )}
                </td>

                {showProject && (
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <Link
                      href={`/proyectos/${task.project.id}`}
                      style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", textDecoration: "none" }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#fd1384")}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--app-text-muted)")}
                    >
                      {task.project.name}
                    </Link>
                  </td>
                )}

                <td style={{ padding: "0.75rem 1rem" }}>
                  <TaskStatusBadge status={task.status as TaskStatus} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <TaskPriorityBadge priority={task.priority as Priority} />
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", fontSize: "0.8125rem" }}>
                  {task.category ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>
                  {task.assignedTo?.name ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                  {task.startDate ? formatDate(task.startDate) : "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                  {task.dueDate ? formatDate(task.dueDate) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
