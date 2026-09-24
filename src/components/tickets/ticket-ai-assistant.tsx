"use client";

import { useState, useTransition, useEffect } from "react";
import { Sparkles, RotateCcw, AlertCircle, X, Minus, Maximize2, Stethoscope } from "lucide-react";
import { AiToolHeader, aiButtonStyle, useAiToolBusy } from "@/components/ui/ai-tools-panel";
import { createPortal } from "react-dom";
import { getTicketDiagnosis } from "@/actions/ai.actions";
import { MarkdownText } from "@/components/ui/markdown-text";
import { ProviderToggle } from "@/components/assistant/provider-toggle";
import { DEFAULT_AI_PROVIDER, type AiProvider } from "@/lib/ai-provider";

export function TicketAiAssistant({
  ticketId,
  provider: controlledProvider,
  onBusy,
}: {
  ticketId: string;
  /** Dentro de `AiToolsPanel`: el panel elige el proveedor y pone la tarjeta. */
  provider?: AiProvider;
  onBusy?: (pending: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ownProvider, setOwnProvider] = useState<AiProvider>(DEFAULT_AI_PROVIDER);
  const [isPending, startTransition] = useTransition();
  const embedded = controlledProvider !== undefined;
  const provider = controlledProvider ?? ownProvider;
  useAiToolBusy(isPending, onBusy);

  function requestDiagnosis() {
    setError(null);
    setOpen(true);
    setMinimized(false);
    startTransition(async () => {
      const res = await getTicketDiagnosis(ticketId, provider);
      if (res.error) setError(res.error);
      else setResult(res.text ?? null);
    });
  }

  function handleClose() {
    setOpen(false);
    setMinimized(false);
  }

  return (
    <>
      <div
        style={
          embedded
            ? undefined
            : { backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem" }
        }
      >
        <AiToolHeader
          icon={<Stethoscope style={{ width: "1rem", height: "1rem" }} />}
          title="Diagnóstico"
          description="Qué está pasando, posibles causas y pasos para resolverlo."
          actions={
            <>
              {!embedded && <ProviderToggle value={provider} onChange={setOwnProvider} disabled={isPending} />}
              {result && !open && (
                <button
                  type="button"
                  onClick={() => { setOpen(true); setMinimized(false); }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.8125rem", fontWeight: 500, color: "#6366f1" }}
                >
                  Ver último
                </button>
              )}
              <button type="button" onClick={requestDiagnosis} disabled={isPending} style={aiButtonStyle(isPending)}>
                {isPending ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Analizando...
                  </>
                ) : (
                  <>
                    <Sparkles style={{ width: "0.875rem", height: "0.875rem" }} />
                    {result ? "Nuevo diagnóstico" : "Solicitar diagnóstico"}
                  </>
                )}
              </button>
            </>
          }
        />
      </div>

      {open && createPortal(
        <DiagnosisPanel
          isPending={isPending}
          result={result}
          error={error}
          minimized={minimized}
          onMinimize={() => setMinimized(true)}
          onRestore={() => setMinimized(false)}
          onRegenerate={requestDiagnosis}
          onClose={handleClose}
        />,
        document.body
      )}
    </>
  );
}

function DiagnosisPanel({
  isPending,
  result,
  error,
  minimized,
  onMinimize,
  onRestore,
  onRegenerate,
  onClose,
}: {
  isPending: boolean;
  result: string | null;
  error: string | null;
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!minimized) onMinimize();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [minimized, onMinimize]);

  /* ── Minimized pill ── */
  if (minimized) {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg cursor-pointer select-none hover:bg-indigo-700 transition-colors"
        onClick={onRestore}
      >
        {isPending ? (
          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        Diagnóstico IA
        <Maximize2 className="w-3.5 h-3.5 opacity-70" />
      </div>
    );
  }

  /* ── Full modal ── */
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onMinimize(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl"
        style={{ maxHeight: "85vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Diagnóstico IA
          </span>
          <div className="flex items-center gap-1">
            {!isPending && (result || error) && (
              <button
                type="button"
                onClick={onRegenerate}
                title="Regenerar"
                className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-gray-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerar
              </button>
            )}
            <button
              type="button"
              onClick={onMinimize}
              title="Minimizar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Minimizar"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex-1">
          {isPending && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <span className="w-8 h-8 border-4 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm">Analizando la incidencia...</span>
            </div>
          )}
          {!isPending && error && (
            <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}
          {!isPending && result && <MarkdownText text={result} />}
        </div>
      </div>
    </div>
  );
}
