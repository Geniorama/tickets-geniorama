"use client";

import { useState, useTransition, useEffect } from "react";
import { Sparkles, RotateCcw, AlertCircle, X } from "lucide-react";
import { createPortal } from "react-dom";
import { getTicketDiagnosis } from "@/actions/ai.actions";

export function TicketAiAssistant({ ticketId }: { ticketId: string }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestDiagnosis() {
    setError(null);
    setModalOpen(true);
    startTransition(async () => {
      const res = await getTicketDiagnosis(ticketId);
      if (res.error) setError(res.error);
      else setResult(res.text ?? null);
    });
  }

  return (
    <>
      {/* Trigger card */}
      <div className="bg-white rounded-xl border border-indigo-200 px-6 py-4 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          Asistente IA
        </span>

        <button
          type="button"
          onClick={requestDiagnosis}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {isPending ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              {result ? "Nuevo diagnóstico" : "Solicitar diagnóstico"}
            </>
          )}
        </button>
      </div>

      {/* Modal */}
      {modalOpen && (
        <DiagnosisModal
          isPending={isPending}
          result={result}
          error={error}
          onRegenerate={requestDiagnosis}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

function DiagnosisModal({
  isPending,
  result,
  error,
  onRegenerate,
  onClose,
}: {
  isPending: boolean;
  result: string | null;
  error: string | null;
  onRegenerate: () => void;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl"
        style={{ maxHeight: "85vh" }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
          <span className="flex items-center gap-2 font-semibold text-gray-900">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Diagnóstico IA
          </span>
          <div className="flex items-center gap-3">
            {!isPending && (result || error) && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal body */}
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

  return createPortal(modal, document.body);
}

/** Minimal markdown renderer — bold, headers, lists */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        if (/^###\s/.test(line))
          return <p key={i} className="font-semibold text-gray-900 mt-4">{line.replace(/^###\s/, "")}</p>;
        if (/^##\s/.test(line))
          return <p key={i} className="font-bold text-gray-900 text-base mt-5">{line.replace(/^##\s/, "")}</p>;
        if (/^#\s/.test(line))
          return <p key={i} className="font-bold text-gray-900 text-lg mt-5">{line.replace(/^#\s/, "")}</p>;
        if (/^\*\*(.+)\*\*$/.test(line))
          return <p key={i} className="font-semibold text-gray-800 mt-4">{line.replace(/\*\*/g, "")}</p>;
        if (/^[-*]\s/.test(line))
          return (
            <div key={i} className="flex gap-2 ml-3">
              <span className="text-indigo-400 shrink-0 mt-0.5">•</span>
              <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
            </div>
          );
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2 ml-3">
              <span className="text-indigo-500 font-medium shrink-0 w-4">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "" || line === "---")
          return <div key={i} className="h-1" />;
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    /^\*\*[^*]+\*\*$/.test(part)
      ? <strong key={i} className="font-semibold text-gray-900">{part.replace(/\*\*/g, "")}</strong>
      : part
  );
}
