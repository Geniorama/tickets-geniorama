"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, User2, UserCheck, Calendar, Clock, FolderOpen, Check, Trash2 } from "lucide-react";
import type { Task, TaskComment, TaskAttachment, TaskTimeEntry, TaskStatus, Priority, User } from "@/generated/prisma";
import type { Session } from "next-auth";
import { TaskStatusBadge, TaskPriorityBadge } from "./project-status-badge";
import { TaskCommentSection } from "./task-comment-form";
import { updateTaskStatus, deleteTask } from "@/actions/task.actions";
import { TaskTimer } from "./task-timer";
import { formatDate, formatDateTimeLong } from "@/lib/format-date";
import { taskCode } from "@/lib/task-code";
import { isStaff, isAdmin } from "@/lib/roles";
import { ExternalLink, FileText, Link2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import type { ReactionEntry } from "@/components/ui/comment-reactions";
import { ReportGenerator } from "@/components/ui/report-generator";
import { generateTaskReport } from "@/actions/report.actions";

type TaskWithDetails = Task & {
  project: { id: string; name: string };
  assignedTo: Pick<User, "id" | "name"> | null;
  createdBy: Pick<User, "id" | "name">;
  comments: (TaskComment & { author: Pick<User, "name">; reactions: ReactionEntry[] })[];
  attachments: TaskAttachment[];
  timeEntries: (TaskTimeEntry & { user: Pick<User, "name"> })[];
};

const taskStatusOptions: { value: TaskStatus; label: string }[] = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "EN_PROGRESO", label: "En progreso" },
  { value: "EN_REVISION", label: "En revisión" },
  { value: "COMPLETADO", label: "Completado" },
];

export function TaskDetail({
  task,
  session,
}: {
  task: TaskWithDetails;
  session: Session;
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const role = session.user.role;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(async () => {
      await updateTaskStatus(task.id, task.project.id, e.target.value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  }

  function handleDelete() {
    if (!confirm("¿Eliminar esta tarea? Esta acción no se puede deshacer.")) return;
    startTransition(async () => {
      await deleteTask(task.id, task.project.id);
    });
  }

  const infoRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.375rem",
    fontSize: "0.75rem",
    color: "var(--app-text-muted)",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Main card */}
          <div
            style={{
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                {task.number > 0 && (
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", letterSpacing: "0.04em" }}>
                    {taskCode(task.project.name, task.number)}
                  </p>
                )}
                <h1
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--app-body-text)",
                    lineHeight: 1.3,
                  }}
                >
                  {task.title}
                </h1>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                {admin && (
                  <Link
                    href={`/proyectos/${task.project.id}/tareas/${task.id}/edit`}
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
                )}
                {admin && (
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.8125rem",
                      color: "#b91c1c",
                      border: "1px solid #fecaca",
                      borderRadius: "0.375rem",
                      padding: "0.25rem 0.625rem",
                      background: "none",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
                    Eliminar
                  </button>
                )}
                <TaskPriorityBadge priority={task.priority as Priority} />
                {staff ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <select
                      defaultValue={task.status}
                      onChange={handleStatusChange}
                      disabled={isPending}
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--app-body-text)",
                        backgroundColor: "var(--app-card-bg)",
                        border: "1px solid var(--app-border)",
                        borderRadius: "0.375rem",
                        padding: "0.25rem 0.5rem",
                        outline: "none",
                      }}
                    >
                      {taskStatusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {saved && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          color: "#15803d",
                          fontWeight: 500,
                        }}
                      >
                        <Check style={{ width: "0.875rem", height: "0.875rem" }} />
                        Guardado
                      </span>
                    )}
                  </div>
                ) : (
                  <TaskStatusBadge status={task.status as TaskStatus} />
                )}
              </div>
            </div>

            <div style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
              <MarkdownRenderer content={task.description} />
            </div>

            <div
              style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid var(--app-border)",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem 1.5rem",
              }}
            >
              <span style={infoRowStyle}>
                <FolderOpen style={{ width: "0.875rem", height: "0.875rem" }} />
                Proyecto:{" "}
                <Link
                  href={`/proyectos/${task.project.id}`}
                  style={{ color: "#fd1384", textDecoration: "none", fontWeight: 500 }}
                >
                  {task.project.name}
                </Link>
              </span>
              <span style={infoRowStyle}>
                <User2 style={{ width: "0.875rem", height: "0.875rem" }} />
                Creado por: <strong style={{ color: "var(--app-body-text)" }}>{task.createdBy.name}</strong>
              </span>
              <span style={infoRowStyle}>
                <UserCheck style={{ width: "0.875rem", height: "0.875rem" }} />
                Asignado a:{" "}
                <strong style={{ color: "var(--app-body-text)" }}>
                  {task.assignedTo?.name ?? "Sin asignar"}
                </strong>
              </span>
              {task.category && (
                <span style={infoRowStyle}>
                  Categoría: <strong style={{ color: "var(--app-body-text)" }}>{task.category}</strong>
                </span>
              )}
              {task.startDate && (
                <span style={infoRowStyle}>
                  <Calendar style={{ width: "0.875rem", height: "0.875rem" }} />
                  Inicio:{" "}
                  <strong style={{ color: "var(--app-body-text)" }}>
                    {formatDate(task.startDate)}{task.startTime ? ` ${task.startTime}` : ""}
                  </strong>
                </span>
              )}
              {task.dueDate && (
                <span style={infoRowStyle}>
                  <Calendar style={{ width: "0.875rem", height: "0.875rem" }} />
                  Vence:{" "}
                  <strong style={{ color: "var(--app-body-text)" }}>
                    {formatDate(task.dueDate)}{task.endTime ? ` ${task.endTime}` : ""}
                  </strong>
                </span>
              )}
              {task.estimatedHours && (
                <span style={infoRowStyle}>
                  <Clock style={{ width: "0.875rem", height: "0.875rem" }} />
                  Horas estimadas:{" "}
                  <strong style={{ color: "var(--app-body-text)" }}>{task.estimatedHours}h</strong>
                </span>
              )}
              <span style={infoRowStyle}>
                <Calendar style={{ width: "0.875rem", height: "0.875rem" }} />
                {formatDateTimeLong(task.createdAt)}
              </span>
            </div>
          </div>

          {/* Attachments */}
          {task.attachments.length > 0 && (
            <div
              style={{
                backgroundColor: "var(--app-card-bg)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.75rem",
                padding: "1.5rem",
              }}
            >
              <h2
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "var(--app-body-text)",
                  marginBottom: "1rem",
                }}
              >
                Archivos adjuntos ({task.attachments.length})
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {task.attachments.map((att) => {
                  const isLink = att.storagePath === "link";
                  return (
                    <a
                      key={att.id}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.875rem",
                        color: "#fd1384",
                        textDecoration: "none",
                      }}
                    >
                      {isLink
                        ? <Link2 style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
                        : <FileText style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
                      }
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.fileName}
                      </span>
                      {isLink && (
                        <ExternalLink style={{ width: "0.75rem", height: "0.75rem", opacity: 0.6, flexShrink: 0 }} />
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {/* Informe IA */}
          {staff && (
            <ReportGenerator
              label="Informe IA"
              generateFn={() => generateTaskReport(task.id)}
            />
          )}

          {/* Timer — solo visible para staff */}
          {staff && (
            <TaskTimer
              taskId={task.id}
              projectId={task.project.id}
              entries={task.timeEntries}
              canControl={staff}
              isAdmin={admin}
              currentUserId={session.user.id}
            />
          )}

          {/* Comments */}
          <div
            style={{
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "0.9375rem",
                fontWeight: 600,
                color: "var(--app-body-text)",
                marginBottom: "1rem",
              }}
            >
              Comentarios ({task.comments.length})
            </h2>
            <TaskCommentSection
              taskId={task.id}
              projectId={task.project.id}
              comments={task.comments.map((c) => ({
                id: c.id,
                body: c.body,
                authorId: c.authorId,
                attachmentType: c.attachmentType,
                attachmentUrl: c.attachmentUrl,
                attachmentName: c.attachmentName,
                createdAt: c.createdAt,
                author: c.author,
                reactions: c.reactions,
              }))}
              currentUserId={session.user.id}
              isAdmin={admin}
            />
          </div>
        </div>
      </div>
  );
}
