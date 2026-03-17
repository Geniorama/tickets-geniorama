"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  isPending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirmColor = variant === "danger" ? "#dc2626" : "#fd1384";
  const confirmHoverColor = variant === "danger" ? "#b91c1c" : "#d40069";

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        padding: "1rem",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "1rem",
          padding: "1.75rem",
          maxWidth: "400px",
          width: "100%",
          boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)", margin: 0 }}>
          {title}
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: 0, lineHeight: 1.6 }}>
          {message}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.625rem", marginTop: "0.5rem" }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--app-border)",
              background: "none",
              color: "var(--app-text-muted)",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--app-body-text)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--app-body-text)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--app-text-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--app-border)"; }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              padding: "0.5rem 1.125rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: confirmColor,
              color: "#ffffff",
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
              transition: "background-color 0.15s",
            }}
            onMouseEnter={e => { if (!isPending) (e.currentTarget as HTMLButtonElement).style.backgroundColor = confirmHoverColor; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = confirmColor; }}
          >
            {isPending ? "Procesando…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
