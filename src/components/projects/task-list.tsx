"use client";

import Link from "next/link";
import type { Task, TaskStatus, Priority } from "@/generated/prisma";
import { TaskStatusBadge, TaskPriorityBadge } from "./project-status-badge";
import { formatDate } from "@/lib/format-date";
import { ListTodo } from "lucide-react";

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
}: {
  tasks: TaskWithRelations[];
  projectId?: string;
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

  const headers = [
    "Título",
    ...(showProject ? ["Proyecto"] : []),
    "Estado",
    "Prioridad",
    "Categoría",
    "Asignado a",
    "Inicio",
    "Vence",
  ];

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
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "0.75rem 1rem",
                  color: "var(--app-text-muted)",
                  fontWeight: 500,
                  fontSize: "0.8125rem",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
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
                    style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                    onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "#fd1384")}
                    onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "var(--app-body-text)")}
                  >
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
