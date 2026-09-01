"use client";

import { useRef, useState, useTransition } from "react";
import { Paperclip, Send, Trash2, FileText, Download } from "lucide-react";
import { addBillingComment, deleteBillingComment, deleteBillingAttachment } from "@/actions/billing-notes.actions";
import { formatDateTimeLong } from "@/lib/format-date";

/**
 * Novedades y soportes de un cobro.
 *
 * Es donde se deja el comprobante de pago y lo que haya pasado —«el cliente
 * pidió plazo», «rebotó la transferencia»—. Va todo en un mismo hilo y no en
 * dos pestañas separadas porque un soporte casi siempre viene con una frase
 * que lo explica, y separarlos obliga a contar la historia dos veces.
 */

export type Novedad = {
  id: string;
  body: string;
  createdAt: Date | string;
  author: { id: string; name: string };
};

export type Soporte = {
  id: string;
  fileName: string | null;
  fileUrl: string | null;
  createdAt: Date | string;
  uploadedBy: { name: string } | null;
};

export function BillingNotes({
  billingItemId,
  comments,
  attachments,
  canEdit,
  currentUserId,
  isAdmin,
}: {
  billingItemId: string;
  comments: Novedad[];
  attachments: Soporte[];
  canEdit: boolean;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function enviar(formData: FormData) {
    setError(null);
    setAviso(null);
    // Los ficheros se llevan desde el estado y no del input: así se ven antes
    // de enviar y se puede quitar alguno.
    formData.delete("files");
    archivos.forEach((f) => formData.append("files", f));

    startTransition(async () => {
      const r = await addBillingComment(billingItemId, formData);
      if (r?.error) return setError(r.error);
      if (r?.warning) setAviso(r.warning);
      setArchivos([]);
      formRef.current?.reset();
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function borrarComentario(id: string) {
    startTransition(async () => {
      const r = await deleteBillingComment(id, billingItemId);
      if (r?.error) setError(r.error);
    });
  }

  function borrarAdjunto(id: string) {
    startTransition(async () => {
      const r = await deleteBillingAttachment(id, billingItemId);
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
        Novedades y soportes
      </p>

      {/* Los soportes primero: es a lo que se entra cuando alguien pregunta si
          ya pagaron. */}
      {attachments.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
          {attachments.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                padding: "0.5rem 0.7rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)",
              }}
            >
              <FileText style={{ width: "0.9rem", height: "0.9rem", color: "var(--app-icon-color)", flexShrink: 0 }} />
              <a
                href={a.fileUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", color: "#fd1384", textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {a.fileName ?? "Archivo"}
              </a>
              <span style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                {a.uploadedBy?.name ?? "—"}
              </span>
              <a
                href={a.fileUrl ?? "#"}
                download
                aria-label={`Descargar ${a.fileName ?? "archivo"}`}
                style={{ color: "var(--app-text-muted)", display: "inline-flex" }}
              >
                <Download style={{ width: "0.85rem", height: "0.85rem" }} />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => borrarAdjunto(a.id)}
                  disabled={isPending}
                  aria-label={`Eliminar ${a.fileName ?? "archivo"}`}
                  style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", display: "inline-flex" }}
                >
                  <Trash2 style={{ width: "0.85rem", height: "0.85rem" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form ref={formRef} action={enviar} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          <textarea
            name="body"
            rows={2}
            placeholder="Una novedad: qué dijeron, qué falta, cuándo prometieron pagar…"
            style={{
              width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
              borderRadius: "0.5rem", border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-bg)", color: "var(--app-body-text)", resize: "vertical",
            }}
          />

          {archivos.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {archivos.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: "0.3rem",
                    fontSize: "0.75rem", padding: "0.2rem 0.5rem", borderRadius: "9999px",
                    border: "1px solid var(--app-border)", color: "var(--app-nav-text)",
                  }}
                >
                  {f.name}
                  <button
                    type="button"
                    onClick={() => setArchivos((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={`Quitar ${f.name}`}
                    style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer" }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                fontSize: "0.8125rem", color: "var(--app-nav-text)", cursor: "pointer",
                padding: "0.45rem 0.7rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)",
              }}
            >
              <Paperclip style={{ width: "0.85rem", height: "0.85rem" }} />
              Adjuntar soporte
              <input
                ref={fileRef}
                type="file"
                multiple
                hidden
                onChange={(e) => setArchivos((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
              />
            </label>

            <button
              type="submit"
              disabled={isPending}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                backgroundColor: "#fd1384", color: "#fff", border: "none",
                borderRadius: "0.5rem", padding: "0.45rem 0.9rem",
                fontSize: "0.8125rem", fontWeight: 500,
                cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              <Send style={{ width: "0.85rem", height: "0.85rem" }} />
              {isPending ? "Guardando..." : "Añadir"}
            </button>
          </div>
        </form>
      )}

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginBottom: "0.75rem" }}>{error}</p>}
      {aviso && <p style={{ fontSize: "0.8125rem", color: "#b45309", marginBottom: "0.75rem" }}>{aviso}</p>}

      {comments.length === 0 && attachments.length === 0 ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          Sin novedades. Aquí van los soportes de pago y lo que haya que recordar.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", gap: "0.6rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.875rem", color: "var(--app-body-text)", whiteSpace: "pre-wrap" }}>
                  {c.body}
                </p>
                <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.15rem" }}>
                  {c.author.name} · {formatDateTimeLong(c.createdAt)}
                </p>
              </div>
              {canEdit && (isAdmin || c.author.id === currentUserId) && (
                <button
                  type="button"
                  onClick={() => borrarComentario(c.id)}
                  disabled={isPending}
                  aria-label="Eliminar novedad"
                  style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", flexShrink: 0 }}
                >
                  <Trash2 style={{ width: "0.85rem", height: "0.85rem" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
