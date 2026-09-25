"use client";

import { useState } from "react";

/**
 * Código con el que se busca el error en los logs del servidor
 * (`pm2 logs tickets-geniorama`). En producción Next oculta el mensaje real y
 * solo deja este `digest`, así que es lo que conviene que el usuario reporte.
 */
export function ErrorReference({ digest }: { digest?: string }) {
  const [copied, setCopied] = useState(false);
  if (!digest) return null;

  function copy() {
    navigator.clipboard
      ?.writeText(digest!)
      .then(() => setCopied(true))
      .catch(() => {});
  }

  return (
    <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>
      Si vuelve a pasar, comparte este código con soporte:{" "}
      <button
        type="button"
        onClick={copy}
        title="Copiar código"
        className="font-mono cursor-pointer"
        style={{
          background: "none",
          border: "1px dashed var(--app-border)",
          borderRadius: "0.25rem",
          padding: "0 0.375rem",
          color: "var(--app-body-text)",
        }}
      >
        {digest}
      </button>
      {copied && <span> · copiado</span>}
    </p>
  );
}
