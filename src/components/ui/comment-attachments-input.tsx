"use client";

import { useEffect, useRef } from "react";
import { Link2, Paperclip, ExternalLink, FileText, X } from "lucide-react";
import { formatFileSize, splitFiles, MAX_FILE_BYTES, type FileRule } from "@/lib/file-rules";

const ACCENT = "#fd1384";

export type PendingLink = { url: string; label: string };

export type CommentAttachment = { type: string | null; url: string; name: string | null };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

/**
 * Un adjunto es imagen si su nombre o la ruta de su URL terminan en una
 * extensión de imagen. La URL se mira sin query: las presignadas llevan firma.
 */
function isImageAttachment(a: CommentAttachment) {
  if (a.type === "link") return false;
  if (a.name && IMAGE_EXT.test(a.name)) return true;
  try {
    return IMAGE_EXT.test(new URL(a.url).pathname);
  } catch {
    return false;
  }
}

/**
 * Miniatura de una imagen aún no subida. La URL blob se crea y se libera en el
 * mismo efecto (así StrictMode la vuelve a crear) y va directa al <img>.
 */
function LocalImagePreview({ file }: { file: File }) {
  const imgRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (imgRef.current) imgRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // eslint-disable-next-line @next/next/no-img-element -- blob: local, no pasa por next/image
  return <img ref={imgRef} alt={file.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
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
  rule,
  onFileError,
  allowLinks = true,
  fileLabel = "Adjuntar archivos",
  multipleHint = "Puedes seleccionar varios archivos a la vez",
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  links: PendingLink[];
  setLinks: React.Dispatch<React.SetStateAction<PendingLink[]>>;
  /** Qué tipos y pesos se admiten; se comprueba al elegir, no al enviar. */
  rule: FileRule;
  /** Recibe los errores de la selección, uno por línea, o null si todo entró. */
  onFileError?: (msg: string | null) => void;
  allowLinks?: boolean;
  fileLabel?: string;
  multipleHint?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const { valid, errors } = splitFiles(Array.from(e.target.files ?? []), rule);
    if (errors.length) {
      onFileError?.(
        errors.join("\n") +
          (allowLinks ? "\nSi es más pesado, súbelo a un servicio externo y compártelo como enlace." : "")
      );
    } else {
      onFileError?.(null);
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

  const removeBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--app-text-muted)",
    display: "flex",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" style={triggerBtn} onClick={() => fileInputRef.current?.click()}>
          <Paperclip style={{ width: "0.875rem", height: "0.875rem" }} />
          {files.length > 0 ? "Añadir más" : fileLabel}
        </button>
        {allowLinks && (
          <button type="button" style={triggerBtn} onClick={() => setLinks((p) => [...p, { url: "", label: "" }])}>
            <Link2 style={{ width: "0.875rem", height: "0.875rem" }} />
            Adjuntar enlace
          </button>
        )}
        <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          {files.length + links.length > 0
            ? `${files.length + links.length} ${files.length + links.length === 1 ? "adjunto" : "adjuntos"} · ${multipleHint.charAt(0).toLowerCase()}${multipleHint.slice(1)}`
            : multipleHint}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={rule.accept}
          onChange={handlePick}
          style={{ display: "none" }}
        />
      </div>

      {/* Lo que se admite, a la vista antes de elegir */}
      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
        {rule.description.charAt(0).toUpperCase() + rule.description.slice(1)} · máx.{" "}
        {formatFileSize(MAX_FILE_BYTES)} cada uno
      </p>

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
            style={removeBtn}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        </div>
      ))}

      {/* Archivos pendientes: miniatura si es imagen, chip si no */}
      {files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start" }}>
          {files.map((f, i) =>
            f.type.startsWith("image/") ? (
              <div
                key={i}
                title={`${f.name} (${formatFileSize(f.size)})`}
                style={{
                  position: "relative",
                  width: "4.5rem",
                  height: "4.5rem",
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                  border: "1px solid var(--app-border)",
                }}
              >
                <LocalImagePreview file={f} />
                <button
                  type="button"
                  onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))}
                  title="Quitar imagen"
                  style={{
                    position: "absolute",
                    top: "0.2rem",
                    right: "0.2rem",
                    width: "1.25rem",
                    height: "1.25rem",
                    borderRadius: "9999px",
                    border: "none",
                    cursor: "pointer",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <X style={{ width: "0.75rem", height: "0.75rem" }} />
                </button>
              </div>
            ) : (
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
                  style={removeBtn}
                >
                  <X style={{ width: "0.75rem", height: "0.75rem" }} />
                </button>
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}

/** Muestra los adjuntos de un comentario: imágenes como miniaturas, el resto como enlaces. */
export function CommentAttachmentsDisplay({ attachments }: { attachments: CommentAttachment[] }) {
  if (attachments.length === 0) return null;
  const images = attachments.filter(isImageAttachment);
  const others = attachments.filter((a) => !isImageAttachment(a));

  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {images.map((a, i) => (
            <a
              key={i}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              title={a.name ?? "Imagen adjunta"}
              style={{
                display: "block",
                width: "7rem",
                height: "7rem",
                borderRadius: "0.5rem",
                overflow: "hidden",
                border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-card-bg)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URLs de R2 (a veces presignadas), fuera de next/image */}
              <img
                src={a.url}
                alt={a.name ?? "Imagen adjunta"}
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </a>
          ))}
        </div>
      )}
      {others.map((a, i) => (
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
