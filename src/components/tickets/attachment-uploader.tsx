"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { addAttachment } from "@/actions/attachment.actions";
import { FILE_RULES, formatFileSize, splitFiles } from "@/lib/file-rules";

export function AttachmentUploader({ ticketId }: { ticketId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { valid, errors } = splitFiles(Array.from(e.target.files ?? []), FILE_RULES.attachment);
    setError(errors.length ? errors.join("\n") : null);
    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (selectedFiles.length === 0) return;

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append("files", file);
    }

    startTransition(async () => {
      const result = await addAttachment(ticketId, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSelectedFiles([]);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Botón seleccionar */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={FILE_RULES.attachment.accept}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--app-body-text)",
            backgroundColor: "var(--app-bg)",
            border: "1px dashed var(--app-border)",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.875rem",
            cursor: "pointer",
          }}
        >
          <Paperclip style={{ width: "0.875rem", height: "0.875rem" }} />
          Seleccionar archivos
        </button>
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.375rem" }}>
          Imágenes, video, PDF, Office o comprimidos · máx. 10 MB (100 MB para video) · puedes seleccionar varios a la vez
        </p>
      </div>

      {/* Lista de archivos seleccionados */}
      {selectedFiles.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {selectedFiles.map((file, idx) => (
            <li
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8125rem",
                backgroundColor: "var(--app-bg)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.375rem",
                padding: "0.375rem 0.625rem",
              }}
            >
              <FileText style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--app-body-text)" }}>
                {file.name}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", flexShrink: 0 }}>
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.125rem",
                  color: "var(--app-text-muted)",
                  flexShrink: 0,
                }}
                aria-label="Quitar archivo"
              >
                <X style={{ width: "0.875rem", height: "0.875rem" }} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Botón subir */}
      {selectedFiles.length > 0 && (
        <div>
          <button
            type="submit"
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "#fff",
              backgroundColor: isPending ? "#818cf8" : "#4f46e5",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.875rem",
              cursor: isPending ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Subiendo..." : `Subir ${selectedFiles.length > 1 ? `${selectedFiles.length} archivos` : "archivo"}`}
          </button>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "0.75rem", color: "#b91c1c", margin: 0, whiteSpace: "pre-line" }}>{error}</p>
      )}
    </form>
  );
}
