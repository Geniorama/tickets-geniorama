"use client";

import { useState, useTransition } from "react";
import { addTaskComment, deleteTaskComment, editTaskComment, getTaskComments } from "@/actions/task-comment.actions";
import { toggleTaskCommentReaction } from "@/actions/reaction.actions";
import { Link2, Paperclip, ExternalLink, FileText, Pencil, Trash2 } from "lucide-react";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { CommentBody } from "@/components/ui/comment-body";
import { CommentReactions, type ReactionEntry } from "@/components/ui/comment-reactions";
import type { ReactionType } from "@/generated/prisma";

type AttachmentMode = "none" | "link" | "file";

interface Comment {
  id: string;
  body: string;
  authorId: string;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date;
  author: { name: string };
  reactions: ReactionEntry[];
}

function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskCommentSection({
  taskId,
  projectId,
  comments,
  totalComments = comments.length,
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  projectId: string;
  comments: Comment[];
  totalComments?: number;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [olderComments, setOlderComments] = useState<Comment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(totalComments > comments.length);

  const allComments = [...olderComments, ...comments];

  return (
    <div>
      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            try {
              const oldest = allComments[0];
              if (!oldest) return;
              const more = await getTaskComments(taskId, oldest.createdAt.toISOString());
              if (more.length < 50) setHasMore(false);
              setOlderComments((prev) => [
                ...more.map((c) => ({
                  id: c.id,
                  body: c.body,
                  authorId: c.authorId,
                  attachmentType: c.attachmentType,
                  attachmentUrl: c.attachmentUrl,
                  attachmentName: c.attachmentName,
                  createdAt: new Date(c.createdAt),
                  author: c.author,
                  reactions: c.reactions,
                })),
                ...prev,
              ]);
            } finally {
              setLoadingMore(false);
            }
          }}
          style={{
            width: "100%",
            marginBottom: "1rem",
            padding: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            borderRadius: "0.5rem",
            border: "1px solid var(--app-border)",
            color: "var(--app-text-muted)",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        >
          {loadingMore ? "Cargando..." : "Cargar comentarios anteriores"}
        </button>
      )}

      {allComments.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {allComments.map((comment) => (
            <TaskCommentItem
              key={comment.id}
              comment={comment}
              taskId={taskId}
              projectId={projectId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
            />
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--app-text-muted)",
            marginBottom: "1.5rem",
          }}
        >
          No hay comentarios aún.
        </p>
      )}

      <TaskCommentForm taskId={taskId} projectId={projectId} />
    </div>
  );
}

function TaskCommentItem({
  comment,
  taskId,
  projectId,
  currentUserId,
  isAdmin,
}: {
  comment: Comment;
  taskId: string;
  projectId: string;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canModify = comment.authorId === currentUserId;

  function handleDelete() {
    if (!confirm("¿Eliminar este comentario?")) return;
    startTransition(async () => {
      await deleteTaskComment(comment.id, taskId, projectId);
    });
  }

  function handleSaveEdit() {
    setError(null);
    startTransition(async () => {
      const result = await editTaskComment(comment.id, taskId, projectId, editBody);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
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
    resize: "vertical" as const,
  };

  return (
    <div
      style={{
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.375rem",
        }}
      >
        <span style={{ fontWeight: 500, fontSize: "0.875rem", color: "var(--app-body-text)" }}>
          {comment.author.name}
        </span>
        <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          {formatDateTime(comment.createdAt)}
        </span>
        {canModify && !editing && (
          <div style={{ display: "flex", gap: "0.25rem" }}>
            <button
              type="button"
              onClick={() => { setEditBody(comment.body); setEditing(true); }}
              title="Editar"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.2rem",
                color: "var(--app-text-muted)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Pencil style={{ width: "0.875rem", height: "0.875rem" }} />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              title="Eliminar"
              style={{
                background: "none",
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                padding: "0.2rem",
                color: "var(--app-text-muted)",
                display: "flex",
                alignItems: "center",
                opacity: isPending ? 0.5 : 1,
              }}
            >
              <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={3}
            style={inputStyle}
          />
          {error && (
            <p style={{ fontSize: "0.75rem", color: "#b91c1c" }}>{error}</p>
          )}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={handleSaveEdit}
              disabled={isPending}
              style={{
                backgroundColor: "#fd1384",
                color: "#fff",
                border: "none",
                borderRadius: "0.375rem",
                padding: "0.375rem 0.875rem",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              style={{
                backgroundColor: "transparent",
                color: "var(--app-body-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.375rem",
                padding: "0.375rem 0.875rem",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <CommentBody
          body={comment.body}
          style={{ fontSize: "0.875rem", color: "var(--app-body-text)" }}
        />
      )}

      {!editing && comment.attachmentUrl && comment.attachmentType === "link" && (
        <a
          href={comment.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "0.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: "#fd1384",
            textDecoration: "none",
          }}
        >
          <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
          {comment.attachmentName ?? comment.attachmentUrl}
        </a>
      )}
      {!editing && comment.attachmentUrl && comment.attachmentType === "file" && (
        <a
          href={comment.attachmentUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: "0.5rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: "#fd1384",
            textDecoration: "none",
          }}
        >
          <FileText style={{ width: "0.875rem", height: "0.875rem" }} />
          {comment.attachmentName ?? "Archivo adjunto"}
        </a>
      )}

      {!editing && (
        <CommentReactions
          reactions={comment.reactions}
          currentUserId={currentUserId}
          onToggle={(type: ReactionType) =>
            toggleTaskCommentReaction(comment.id, taskId, projectId, type)
          }
        />
      )}
    </div>
  );
}

function TaskCommentForm({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [attachMode, setAttachMode] = useState<AttachmentMode>("none");
  const [error, setError] = useState<string | null>(null);

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("attachmentType", attachMode === "none" ? "" : attachMode);

    startTransition(async () => {
      const result = await addTaskComment(taskId, projectId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        form.reset();
        setAttachMode("none");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <MentionTextarea
        required
        rows={3}
        placeholder="Escribe un comentario… usa @ para mencionar a alguien"
        style={inputStyle}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          Adjuntar:
        </span>
        <button
          type="button"
          onClick={() => setAttachMode(attachMode === "link" ? "none" : "link")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.25rem 0.625rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 500,
            border: `1px solid ${attachMode === "link" ? "#fd1384" : "var(--app-border)"}`,
            backgroundColor: attachMode === "link" ? "rgba(253,19,132,0.08)" : "transparent",
            color: attachMode === "link" ? "#fd1384" : "var(--app-text-muted)",
            cursor: "pointer",
          }}
        >
          <Link2 style={{ width: "0.75rem", height: "0.75rem" }} />
          Enlace
        </button>
        <button
          type="button"
          onClick={() => setAttachMode(attachMode === "file" ? "none" : "file")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.25rem 0.625rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 500,
            border: `1px solid ${attachMode === "file" ? "#fd1384" : "var(--app-border)"}`,
            backgroundColor: attachMode === "file" ? "rgba(253,19,132,0.08)" : "transparent",
            color: attachMode === "file" ? "#fd1384" : "var(--app-text-muted)",
            cursor: "pointer",
          }}
        >
          <Paperclip style={{ width: "0.75rem", height: "0.75rem" }} />
          Archivo
        </button>
      </div>

      {attachMode === "link" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
              URL *
            </label>
            <input name="linkUrl" type="url" required placeholder="https://..." style={inputStyle} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
              Etiqueta (opcional)
            </label>
            <input name="linkLabel" type="text" placeholder="Nombre del enlace" style={inputStyle} />
          </div>
        </div>
      )}

      {attachMode === "file" && (
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
            Archivo * (imágenes, PDF, Word — máx. 10 MB)
          </label>
          <input
            name="attachmentFile"
            type="file"
            required
            accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx"
            style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}
          />
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
            padding: "0.5rem 0.75rem",
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
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
          {isPending ? "Enviando..." : "Comentar"}
        </button>
      </div>
    </form>
  );
}
