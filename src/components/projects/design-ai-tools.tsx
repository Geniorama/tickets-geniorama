"use client";

import { useState, useTransition } from "react";
import { Lightbulb, ImageIcon, Copy, Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { generateDesignBrief, generateDesignSketches } from "@/actions/design.actions";
import { AiToolHeader, aiButtonStyle, useAiToolBusy, AI_ACCENT } from "@/components/ui/ai-tools-panel";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { SKETCH_FORMATS, MAX_SKETCHES, type SketchFormatId } from "@/lib/design-tasks";
import type { AiProvider } from "@/lib/ai-provider";

const fieldStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem",
  fontSize: "0.8125rem",
  color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.375rem",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--app-text-muted)",
  marginBottom: "0.375rem",
};

const spin: React.CSSProperties = { width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" };

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: 0, padding: "0.75rem 1.25rem", fontSize: "0.8125rem", color: "#b91c1c", backgroundColor: "#fef2f2", borderTop: "1px solid #fecaca" }}>
      {children}
    </p>
  );
}

/**
 * Herramientas de IA de una tarea de diseño: el brief creativo y los bocetos.
 * Van dentro de `AiToolsPanel`, como filas junto al informe. El brief se
 * comparte con los bocetos para que partan de la misma idea.
 */
export function DesignAiTools({
  taskId,
  provider,
  onBusy,
}: {
  taskId: string;
  provider: AiProvider;
  onBusy: (pending: boolean) => void;
}) {
  const [brief, setBrief] = useState<string | null>(null);
  return (
    <>
      <BriefTool taskId={taskId} provider={provider} onBusy={onBusy} brief={brief} onBrief={setBrief} />
      <SketchesTool taskId={taskId} onBusy={onBusy} brief={brief} />
    </>
  );
}

// ─── Brief creativo ───────────────────────────────────────────────────────────

function BriefTool({
  taskId,
  provider,
  onBusy,
  brief,
  onBrief,
}: {
  taskId: string;
  provider: AiProvider;
  onBusy: (pending: boolean) => void;
  brief: string | null;
  onBrief: (brief: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  useAiToolBusy(isPending, onBusy);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateDesignBrief(taskId, provider);
      if (res.error) { setError(res.error); return; }
      if (res.brief) { onBrief(res.brief); setOpen(true); }
    });
  }

  async function copy() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permiso de portapapeles: no pasa nada */ }
  }

  const ghostBtn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem",
    fontSize: "0.8125rem", fontWeight: 500, border: "1px solid var(--app-border)", borderRadius: "0.375rem",
    backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", cursor: "pointer",
  };

  return (
    <div>
      <AiToolHeader
        icon={<Lightbulb style={{ width: "1rem", height: "1rem" }} />}
        title="Brief creativo"
        description="Objetivo, formato y medidas, opciones de copy y dirección visual para el diseñador."
        actions={
          <>
            {brief && (
              <button type="button" onClick={copy} style={ghostBtn}>
                {copied ? <Check style={{ width: "0.875rem", height: "0.875rem" }} /> : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            )}
            <button type="button" onClick={generate} disabled={isPending} style={aiButtonStyle(isPending)}>
              {isPending ? <><Loader2 style={spin} /> Generando...</> : brief ? "Regenerar" : "Generar brief"}
            </button>
            {brief && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-label={open ? "Ocultar brief" : "Mostrar brief"}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)", display: "flex" }}
              >
                {open ? <ChevronUp style={{ width: "1rem", height: "1rem" }} /> : <ChevronDown style={{ width: "1rem", height: "1rem" }} />}
              </button>
            )}
          </>
        }
      />
      {error && <ErrorLine>{error}</ErrorLine>}
      {brief && open && (
        <div
          style={{
            borderTop: "1px solid var(--app-border)",
            padding: "1rem 1.25rem",
            backgroundColor: "var(--app-content-bg)",
            maxHeight: "28rem",
            overflowY: "auto",
            fontSize: "0.8125rem",
            lineHeight: 1.65,
          }}
        >
          <MarkdownRenderer content={brief} />
        </div>
      )}
    </div>
  );
}

// ─── Bocetos ──────────────────────────────────────────────────────────────────

function SketchesTool({
  taskId,
  onBusy,
  brief,
}: {
  taskId: string;
  onBusy: (pending: boolean) => void;
  brief: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<SketchFormatId>("cuadrado");
  const [count, setCount] = useState(2);
  const [instructions, setInstructions] = useState("");
  const [useBrief, setUseBrief] = useState(true);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  useAiToolBusy(isPending, onBusy);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateDesignSketches(taskId, {
        format,
        count,
        instructions,
        brief: useBrief && brief ? brief : undefined,
      });
      if (res.error) { setError(res.error); return; }
      setImages(res.images ?? []);
      if (res.saveErrors?.length) setError(`Algunos bocetos no se guardaron: ${res.saveErrors.join("; ")}`);
    });
  }

  return (
    <div>
      <AiToolHeader
        icon={<ImageIcon style={{ width: "1rem", height: "1rem" }} />}
        title="Bocetos"
        description="Propuestas visuales con OpenAI para inspirar el diseño, no piezas finales. Se guardan en Adjuntos."
        actions={
          <button type="button" onClick={generate} disabled={isPending} style={aiButtonStyle(isPending)}>
            {isPending ? <><Loader2 style={spin} /> Generando…</> : images.length ? "Generar otros" : "Generar bocetos"}
          </button>
        }
      />

      {/* Opciones */}
      <div
        style={{
          borderTop: "1px solid var(--app-border)",
          padding: "0.875rem 1.25rem",
          backgroundColor: "var(--app-content-bg)",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 12rem" }}>
            <label style={labelStyle} htmlFor={`sketch-format-${taskId}`}>Formato</label>
            <select
              id={`sketch-format-${taskId}`}
              value={format}
              onChange={(e) => setFormat(e.target.value as SketchFormatId)}
              disabled={isPending}
              style={{ ...fieldStyle, width: "100%" }}
            >
              {SKETCH_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label} — {f.hint}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle} htmlFor={`sketch-count-${taskId}`}>Cantidad</label>
            <select
              id={`sketch-count-${taskId}`}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={isPending}
              style={fieldStyle}
            >
              {Array.from({ length: MAX_SKETCHES }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle} htmlFor={`sketch-notes-${taskId}`}>Indicaciones (opcional)</label>
          <textarea
            id={`sketch-notes-${taskId}`}
            rows={2}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isPending}
            placeholder="Ej.: fondo claro, producto al centro, estilo minimalista, colores de marca azul y naranja"
            style={{ ...fieldStyle, width: "100%", resize: "vertical", lineHeight: 1.5 }}
          />
        </div>

        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", color: brief ? "var(--app-body-text)" : "var(--app-text-muted)", cursor: brief ? "pointer" : "default" }}>
          <input
            type="checkbox"
            checked={!!brief && useBrief}
            disabled={!brief || isPending}
            onChange={(e) => setUseBrief(e.target.checked)}
            style={{ accentColor: AI_ACCENT }}
          />
          {brief ? "Partir del brief creativo generado" : "Genera antes el brief para que los bocetos partan de él"}
        </label>
      </div>

      {error && <ErrorLine>{error}</ErrorLine>}

      {isPending && (
        <p style={{ margin: 0, padding: "0.75rem 1.25rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", borderTop: "1px solid var(--app-border)" }}>
          Generando {count === 1 ? "el boceto" : `${count} bocetos`}. Puede tardar un minuto.
        </p>
      )}

      {images.length > 0 && !isPending && (
        <div style={{ borderTop: "1px solid var(--app-border)", padding: "0.875rem 1.25rem", display: "flex", flexWrap: "wrap", gap: "0.625rem" }}>
          {images.map((img) => (
            <a
              key={img.url}
              href={img.url}
              target="_blank"
              rel="noopener noreferrer"
              title={img.name}
              style={{ display: "block", width: "8rem", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid var(--app-border)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URLs de R2 (a veces presignadas), fuera de next/image */}
              <img src={img.url} alt={img.name} loading="lazy" style={{ width: "100%", display: "block" }} />
            </a>
          ))}
          <p style={{ flexBasis: "100%", margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
            Guardados en la pestaña Adjuntos de la tarea.
          </p>
        </div>
      )}
    </div>
  );
}
