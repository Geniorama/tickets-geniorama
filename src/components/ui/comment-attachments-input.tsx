"use client";

import { useRef } from "react";
import { Link2, Paperclip, ExternalLink, FileText, X } from "lucide-react";

const ACCENT = "#fd1384";

export type PendingLink = { url: string; label: string };

export type CommentAttachment = { type: string | null; url: string; name: string | null };

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Añade los adjuntos pendientes (archivos y enlaces) a un FormData. */
export function appendCommentAttachments(fd: FormData, files: File[], links: PendingLink[]) {
  for (const f of files) fd.append("attachmentFiles", f);
  const cleanLinks = links
    .map((l) => ({ url: l.url.trim(), label: l.label.trim() }))
    .filter((l) => l.url);
  if (cleanLinks.length) fd.set("links", JSON.stringify(cleanLinks));
}

/** Editor de adjuntos múltiples (varios archivos y varios enlaces) para comentarios. */
export function CommentAttachmentsInput({
  files,
  setFiles,
  links,
  setLinks,
  maxFileBytes,
  accept,
  onFileError,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  links: PendingLink[];
  setLinks: React.Dispatch<React.SetStateAction<PendingLink[]>>;
  maxFileBytes: number;
  accept?: string;
  onFileError?: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const valid: File[] = [];
    for (const f of picked) {
      if (f.size > maxFileBytes) {
        onFileError?.(
          `"${f.name}" supera los ${formatFileSize(maxFileBytes)} (${formatFileSize(f.size)}). Súbelo a un servicio externo y compártelo como enlace.`
        );
        continue;
      }
      valid.push(f);
    }
    if (valid.length) setFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  }

  const triggerBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.45rem 0.85rem",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    border: `1px solid ${ACCENT}`,
    backgroundColor: "rgba(253,19,132,0.08)",
    color: ACCENT,
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    border: "1px solid var(--app-border)",
    borderRadius: "0.5rem",
    padding: "0.4rem 0.6rem",
    fontSize: "0.8125rem",
    color: "var(--app-body-text)",
    backgroundColor: "var(--app-card-bg)",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" style={triggerBtn} onClick={() => fileInputRef.current?.click()}>
          <Paperclip style={{ width: "0.875rem", height: "0.875rem" }} />
          Adjuntar archivo
        </button>
        <button type="button" style={triggerBtn} onClick={() => setLinks((p) => [...p, { url: "", label: "" }])}>
          <Link2 style={{ width: "0.875rem", height: "0.875rem" }} />
          Adjuntar enlace
        </button>
        {(files.length > 0 || links.length > 0) && (
          <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
            {files.length + links.length} {files.length + links.length === 1 ? "adjunto" : "adjuntos"}
          </span>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={handlePick}
          style={{ display: "none" }}
        />
      </div>

      {/* Enlaces pendientes */}
      {links.map((link, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="url"
            value={link.url}
            placeholder="https://..."
            onChange={(e) => setLinks((p) => p.map((l, idx) => (idx === i ? { ...l, url: e.target.value } : l)))}
            style={inputStyle}
          />
          <input
            type="text"
            value={link.label}
            placeholder="Etiqueta (opcional)"
            onChange={(e) => setLinks((p) => p.map((l, idx) => (idx === i ? { ...l, label: e.target.value } : l)))}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => setLinks((p) => p.filter((_, idx) => idx !== i))}
            title="Quitar enlace"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", display: "flex" }}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        </div>
      ))}

      {/* Archivos pendientes */}
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {files.map((f, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.375rem",
                fontSize: "0.75rem",
                backgroundColor: "rgba(253,19,132,0.08)",
                border: `1px solid ${ACCENT}`,
                color: "var(--app-body-text)",
              }}
            >
              <FileText style={{ width: "0.75rem", height: "0.75rem", color: ACCENT }} />
              {f.name} <span style={{ color: "var(--app-text-muted)" }}>({formatFileSize(f.size)})</span>
              <button
                type="button"
                onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                title="Quitar archivo"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", display: "flex" }}
              >
                <X style={{ width: "0.75rem", height: "0.75rem" }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Muestra los adjuntos de un comentario (enlaces y archivos). */
export function CommentAttachmentsDisplay({ attachments }: { attachments: CommentAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {attachments.map((a, i) => (
        <a
          key={i}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            color: ACCENT,
            textDecoration: "none",
          }}
        >
          {a.type === "link" ? (
            <ExternalLink style={{ width: "0.875rem", height: "0.875rem" }} />
          ) : (
            <FileText style={{ width: "0.875rem", height: "0.875rem" }} />
          )}
          {a.name ?? (a.type === "link" ? a.url : "Archivo adjunto")}
        </a>
      ))}
    </div>
  );
}

/** Combina el adjunto único heredado (columnas antiguas) con los adjuntos nuevos. */
export function mergeAttachments(
  legacy: { attachmentType: string | null; attachmentUrl: string | null; attachmentName: string | null },
  attachments?: CommentAttachment[]
): CommentAttachment[] {
  const out: CommentAttachment[] = [];
  if (legacy.attachmentUrl) {
    out.push({ type: legacy.attachmentType, url: legacy.attachmentUrl, name: legacy.attachmentName });
  }
  if (attachments) out.push(...attachments);
  return out;
}
