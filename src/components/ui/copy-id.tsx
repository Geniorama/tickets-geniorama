"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Muestra un identificador en formato monoespaciado con botón para copiarlo.
 * Útil para distinguir registros que pueden compartir el mismo nombre (p. ej. planes).
 */
export function CopyId({
  value,
  label = "ID",
  style,
}: {
  value: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {}
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copiar ${label}: ${value}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: "0.6875rem",
        fontWeight: 500,
        padding: "0.1rem 0.4rem",
        borderRadius: "0.25rem",
        border: "1px solid var(--app-border)",
        backgroundColor: "var(--app-content-bg)",
        color: "var(--app-text-muted)",
        cursor: "pointer",
        lineHeight: 1.4,
        ...style,
      }}
    >
      <span>
        {label}: {value}
      </span>
      {copied ? (
        <Check style={{ width: "0.75rem", height: "0.75rem", color: "#16a34a" }} />
      ) : (
        <Copy style={{ width: "0.75rem", height: "0.75rem", opacity: 0.6 }} />
      )}
    </button>
  );
}
