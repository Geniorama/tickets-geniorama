"use client";

import { useState, useTransition } from "react";
import { addTaskComment } from "@/actions/task-comment.actions";
import { Link2, Paperclip, ExternalLink, FileText } from "lucide-react";

type AttachmentMode = "none" | "link" | "file";

interface Comment {
  id: string;
  body: string;
  attachmentType: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: Date;
  author: { name: string };
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
  currentUserId,
  isAdmin,
}: {
  taskId: string;
  projectId: string;
  comments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  return (
    <div>
      {comments.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {comments.map((comment) => (
            <div
              key={comment.id}
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
                <span
                  style={{
                    fontWeight: 500,
                    fontSize: "0.875rem",
                    color: "var(--app-body-text)",
                  }}
                >
                  {comment.author.name}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "0.75rem",
                    color: "var(--app-text-muted)",
                  }}
                >
                  {formatDateTime(comment.createdAt)}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--app-body-text)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {comment.body}
              </p>
              {comment.attachmentUrl && comment.attachmentType === "link" && (
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
              {comment.attachmentUrl && comment.attachmentType === "file" && (
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
            </div>
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
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Escribe un comentario..."
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
