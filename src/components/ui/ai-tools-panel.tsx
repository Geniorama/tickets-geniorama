"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import { DEFAULT_AI_PROVIDER, type AiProvider } from "@/lib/ai-provider";

export const AI_ACCENT = "#6366f1";

/**
 * Las herramientas de IA de una ficha (diagnóstico, informe…) en una sola
 * tarjeta, con un único selector de proveedor para todas. Cada herramienta se
 * pinta como una fila con `AiToolHeader`, así se ven como partes de lo mismo.
 */
export function AiToolsPanel({
  children,
  showProviderToggle = true,
}: {
  children: (provider: AiProvider, busy: (pending: boolean) => void) => React.ReactNode;
  /** El cliente no elige proveedor: usa el principal. */
  showProviderToggle?: boolean;
}) {
  const [provider, setProvider] = useState<AiProvider>(DEFAULT_AI_PROVIDER);
  // Mientras una herramienta trabaja no se cambia de proveedor: el resultado
  // quedaría atribuido al que no lo generó.
  const [pendingCount, setPendingCount] = useState(0);
  // Estable: las herramientas lo usan como dependencia de un efecto
  const busy = useCallback(
    (pending: boolean) => setPendingCount((n) => Math.max(0, n + (pending ? 1 : -1))),
    []
  );

  return (
    <section
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          flexWrap: "wrap",
          padding: "0.875rem 1.25rem",
          borderBottom: "1px solid var(--app-border)",
        }}
      >
        <h2
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            margin: 0,
            fontSize: "0.9375rem",
            fontWeight: 600,
            color: "var(--app-body-text)",
          }}
        >
          <Sparkles style={{ width: "1rem", height: "1rem", color: AI_ACCENT, flexShrink: 0 }} />
          Herramientas IA
        </h2>
        {showProviderToggle && (
          <ProviderToggle value={provider} onChange={setProvider} disabled={pendingCount > 0} />
        )}
      </div>

      <div className="ai-tools-list">{children(provider, busy)}</div>
    </section>
  );
}

/**
 * Lo que ve un cliente cuyo plan no incluye las herramientas de IA: que
 * existen, qué hacen y cómo conseguirlas. Sin botones que no puede usar.
 */
export function AiToolsLocked({ tools }: { tools: string[] }) {
  return (
    <section
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px dashed var(--app-border)",
        borderRadius: "0.75rem",
        padding: "0.875rem 1.25rem",
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          margin: 0,
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--app-text-muted)",
        }}
      >
        <Lock style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
        Herramientas IA
      </h2>
      <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>
        {tools.join(" y ")} con inteligencia artificial, disponibles con un plan que incluya{" "}
        <strong>herramientas de IA</strong>. Ponte en contacto con tu agente para activarlas.
      </p>
    </section>
  );
}

/** Cabecera de una herramienta dentro del panel: icono, nombre, qué hace y sus botones. */
export function AiToolHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actions: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.75rem",
        flexWrap: "wrap",
        padding: "0.875rem 1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", minWidth: 0, flex: "1 1 12rem" }}>
        <span style={{ color: AI_ACCENT, display: "flex", marginTop: "0.125rem", flexShrink: 0 }}>{icon}</span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>{title}</p>
          {description && (
            <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{description}</p>
          )}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>{actions}</div>
    </div>
  );
}

/** Avisa al panel mientras la herramienta trabaja, para bloquear el selector. */
export function useAiToolBusy(isPending: boolean, onBusy?: (pending: boolean) => void) {
  useEffect(() => {
    if (!isPending || !onBusy) return;
    onBusy(true);
    return () => onBusy(false);
  }, [isPending, onBusy]);
}

/** Botón principal de una herramienta de IA. */
export function aiButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.375rem",
    padding: "0.375rem 0.875rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    border: "none",
    borderRadius: "0.375rem",
    backgroundColor: AI_ACCENT,
    color: "#fff",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    whiteSpace: "nowrap",
  };
}
