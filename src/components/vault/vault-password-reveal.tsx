"use client";

import { useState } from "react";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

export function VaultPasswordReveal({ password }: { password: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{
        fontFamily: "var(--font-mono, monospace)", fontSize: "0.9rem",
        color: "var(--app-body-text)", letterSpacing: visible ? "normal" : "0.15em",
        minWidth: "8rem",
      }}>
        {visible ? password : "•".repeat(Math.min(password.length, 16))}
      </span>
      <button
        onClick={() => setVisible((v) => !v)}
        title={visible ? "Ocultar" : "Mostrar"}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "var(--app-text-muted)", display: "flex", alignItems: "center", padding: "0.125rem",
        }}
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
      <button
        onClick={handleCopy}
        title="Copiar contraseña"
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: copied ? "#16a34a" : "var(--app-text-muted)", display: "flex", alignItems: "center", padding: "0.125rem",
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
