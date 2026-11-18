"use client";

/**
 * Menú de acciones («⋯») para tarjetas y cabeceras de columna.
 *
 * Reúne en un solo botón lo que antes eran iconos sueltos que se montaban sobre
 * los títulos. Para el clic —la tarjeta entera es un enlace— y se cierra al
 * pulsar fuera o con Escape.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export type ActionMenuItem = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
};

export function ActionMenu({ items, ariaLabel }: { items: ActionMenuItem[]; ariaLabel: string }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Acciones"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAbierto((v) => !v); }}
        style={{
          display: "inline-flex", padding: "0.125rem", borderRadius: "0.25rem",
          background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)",
        }}
      >
        <MoreHorizontal style={{ width: "1rem", height: "1rem" }} />
      </button>

      {abierto && (
        <div
          role="menu"
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: "0.25rem", zIndex: 50,
            minWidth: "11rem", padding: "0.25rem",
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.5rem", boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={(e) => {
                e.preventDefault(); e.stopPropagation();
                setAbierto(false);
                it.onClick();
              }}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", width: "100%",
                padding: "0.4rem 0.6rem", borderRadius: "0.375rem", border: "none",
                background: "none", cursor: "pointer", textAlign: "left",
                fontSize: "0.8125rem", color: it.danger ? "#dc2626" : "var(--app-body-text)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--app-content-bg)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
