"use client";

import { useState, useTransition } from "react";
import { addTaskComment, deleteTaskComment, editTaskComment, getTaskComments } from "@/actions/task-comment.actions";
import { toggleTaskCommentReaction } from "@/actions/reaction.actions";
import { Pencil, Trash2 } from "lucide-react";
import { MentionTextarea } from "@/components/ui/mention-textarea";
import { CommentBody } from "@/components/ui/comment-body";
import { CommentReactions, type ReactionEntry } from "@/components/ui/comment-reactions";
import {
  CommentAttachmentsInput, CommentAttachmentsDisplay, appendCommentAttachments, mergeAttachments,
  type PendingLink, type CommentAttachment,
} from "@/components/ui/comment-attachments-input";
import type { ReactionType } from "@/generated/prisma";

const COMMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const COMMENT_FILE_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

interface Comment {
  id: string;
  body: string;
  authorId: string;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachments: CommentAttachment[];
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
  projectId: string | null;
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
                  attachments: c.attachments,
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
  projectId: string | null;
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

      {!editing && (
        <CommentAttachmentsDisplay attachments={mergeAttachments(comment, comment.attachments)} />
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
  projectId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<PendingLink[]>([]);
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
    appendCommentAttachments(formData, files, links);
    const hasFile = files.length > 0;

    startTransition(async () => {
      try {
        const result = await addTaskComment(taskId, projectId, formData);
        if (result?.error) {
          setError(result.error);
        } else {
          form.reset();
          setFiles([]);
          setLinks([]);
        }
      } catch (err) {
        console.error("[addTaskComment]", err);
        const msg = err instanceof Error ? err.message : "";
        if (hasFile && /unexpected response|fetch|network|413/i.test(msg)) {
          setError(
            "No se pudo enviar el comentario: los archivos adjuntos fueron rechazados por el servidor (pueden ser demasiado pesados). Intenta con archivos más pequeños o compártelos como enlace."
          );
        } else {
          setError("No se pudo enviar el comentario. Intenta de nuevo en unos segundos.");
        }
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

      <CommentAttachmentsInput
        files={files}
        setFiles={setFiles}
        links={links}
        setLinks={setLinks}
        maxFileBytes={COMMENT_MAX_FILE_BYTES}
        accept={COMMENT_FILE_ACCEPT}
        onFileError={setError}
      />

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
