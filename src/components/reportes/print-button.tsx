"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Exportar PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 1rem",
        borderRadius: "0.5rem",
        border: "none",
        backgroundColor: "#fd1384",
        color: "#ffffff",
        fontSize: "0.875rem",
        fontWeight: 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      <Printer style={{ width: "1rem", height: "1rem" }} />
      {label}
    </button>
  );
}
