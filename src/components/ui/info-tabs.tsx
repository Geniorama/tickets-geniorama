"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

const ACCENT = "#fd1384";
const FILLED = "#16a34a";

export type InfoTab = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /**
   * Resumen de lo que hay («3/5», «2», «1h 20m»). null = la sección está vacía:
   * la pestaña se marca como pendiente de diligenciar.
   */
  summary: string | null;
  content: React.ReactNode;
};

/**
 * Agrupa la información adjunta de una ficha (checklist, adjuntos, Bóveda,
 * tiempo…) en un solo panel con pestañas. Cada pestaña dice de un vistazo si
 * la sección tiene contenido —✓ y su resumen— o está vacía.
 *
 * Los paneles se montan todos y solo se ocultan: así un cronómetro sigue
 * corriendo o un checklist a medio editar no se pierde al cambiar de pestaña.
 * Cada panel trae su propia tarjeta; `.info-tabs-body` en globals.css le quita
 * el marco para que no quede una tarjeta dentro de otra.
 */
export function InfoTabs({ tabs, title = "Información" }: { tabs: InfoTab[]; title?: string }) {
  const baseId = useId();
  const [active, setActive] = useState(
    () => (tabs.find((t) => t.summary !== null) ?? tabs[0])?.id
  );
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (tabs.length === 0) return null;
  // Si la pestaña activa deja de existir (p. ej. cambia el rol), se vuelve a la primera
  const current = tabs.some((t) => t.id === active) ? active : tabs[0].id;
  const filled = tabs.filter((t) => t.summary !== null).length;

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + tabs.length) % tabs.length;
    setActive(tabs[next].id);
    tabRefs.current[next]?.focus();
  }

  return (
    <section
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "1rem 1.25rem 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>{title}</h2>
          <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
            {filled} de {tabs.length} con contenido
          </span>
        </div>

        <div
          role="tablist"
          aria-label={title}
          style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", paddingBottom: "0.875rem", borderBottom: "1px solid var(--app-border)" }}
        >
          {tabs.map((tab, i) => {
            const selected = tab.id === current;
            const isFilled = tab.summary !== null;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[i] = el; }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                title={isFilled ? `${tab.label}: ${tab.summary}` : `${tab.label}: sin diligenciar`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.375rem 0.625rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  fontWeight: selected ? 600 : 500,
                  cursor: "pointer",
                  border: `1px ${isFilled ? "solid" : "dashed"} ${selected ? ACCENT : "var(--app-border)"}`,
                  backgroundColor: selected ? "rgba(253,19,132,0.08)" : "transparent",
                  color: selected ? ACCENT : isFilled ? "var(--app-body-text)" : "var(--app-text-muted)",
                }}
              >
                {isFilled ? (
                  <CheckCircle2 aria-hidden style={{ width: "0.875rem", height: "0.875rem", color: FILLED, flexShrink: 0 }} />
                ) : (
                  <Circle aria-hidden style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0, opacity: 0.6 }} />
                )}
                {tab.icon}
                {tab.label}
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "0.05rem 0.4rem",
                    borderRadius: "9999px",
                    backgroundColor: isFilled ? "rgba(22,163,74,0.12)" : "transparent",
                    color: isFilled ? FILLED : "var(--app-text-muted)",
                    fontStyle: isFilled ? "normal" : "italic",
                  }}
                >
                  {isFilled ? tab.summary : "vacío"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== current}
          className="info-tabs-body"
        >
          {tab.content}
        </div>
      ))}
    </section>
  );
}

/** Mensaje para una pestaña vacía, con una pista de cómo llenarla. */
export function InfoTabEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: "1.25rem 1.5rem", fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
      {children}
    </p>
  );
}
