"use client";

import { useState, useTransition } from "react";
import { Sparkles, ChevronDown, ChevronRight, AlertCircle } from "lucide-react";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import {
  generateTemplateDraft,
  type TemplateDraft,
  type TemplateKind,
} from "@/actions/template-ai.actions";
import type { AiProvider } from "@/lib/ai";

/**
 * Panel que va encima del formulario de plantillas: se describe en una frase lo
 * que se necesita y la IA prellena todos los campos. Nada se guarda hasta que
 * quien crea la plantilla revisa el borrador y pulsa «Crear plantilla».
 */

const PLACEHOLDER: Record<TemplateKind, string> = {
  TASK: "Ej: publicación mensual de Instagram para un cliente de retail — briefing, diseño de piezas, copys, aprobación y programación.",
  TICKET: "Ej: el sitio de un cliente está caído — datos a pedir, revisión de hosting y DNS, logs y aviso al cliente.",
};

export function AiTemplateGenerator({
  kind,
  onGenerated,
  defaultOpen = true,
  willReplace = false,
}: {
  kind: TemplateKind;
  onGenerated: (draft: TemplateDraft) => void;
  /** El panel arranca plegado al editar, para no invitar a pisar lo ya escrito. */
  defaultOpen?: boolean;
  /** Avisa de que generar sobrescribe lo que ya hay en el formulario. */
  willReplace?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const res = await generateTemplateDraft({ kind, prompt, provider });
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onGenerated(res);
      setDone(true);
    });
  }

  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        backgroundColor: "var(--app-input-bg)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          padding: "0.625rem 0.75rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--app-body-text)",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        <Sparkles size={16} style={{ color: "#fd1384", flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Generar plantilla con IA</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <div style={{ padding: "0 0.75rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
            Describe el trabajo en una o dos frases. La IA propone título, descripción, prioridad,
            categoría{kind === "TASK" ? ", tiempo estimado" : ""} y checklist
            {willReplace ? " — y reemplaza lo que ya hay en el formulario." : "; puedes ajustarlo todo antes de guardar."}
          </p>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={2000}
            disabled={isPending}
            placeholder={PLACEHOLDER[kind]}
            style={{
              width: "100%",
              resize: "vertical",
              border: "1px solid var(--app-border)",
              borderRadius: "0.5rem",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              fontFamily: "inherit",
              color: "var(--app-body-text)",
              backgroundColor: "var(--app-card-bg)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />

          {error && (
            <p
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.375rem",
                margin: 0,
                fontSize: "0.8125rem",
                color: "#b91c1c",
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "0.125rem" }} />
              {error}
            </p>
          )}

          {done && !error && (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#15803d" }}>
              Borrador generado. Revisa los campos y ajústalos antes de guardar.
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <ProviderToggle value={provider} onChange={setProvider} disabled={isPending} />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isPending || !prompt.trim()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#4f46e5",
                color: "#fff",
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                border: "none",
                cursor: isPending || !prompt.trim() ? "not-allowed" : "pointer",
                opacity: isPending || !prompt.trim() ? 0.6 : 1,
              }}
            >
              <Sparkles size={16} />
              {isPending ? "Generando…" : done ? "Generar de nuevo" : "Generar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
