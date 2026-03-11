"use client";

import { useState, useTransition } from "react";
import { Sparkles, ChevronDown, RotateCcw, AlertCircle } from "lucide-react";
import { getTicketDiagnosis } from "@/actions/ai.actions";

export function TicketAiAssistant({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function requestDiagnosis() {
    setError(null);
    startTransition(async () => {
      const res = await getTicketDiagnosis(ticketId);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res.text ?? null);
        setOpen(true);
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-indigo-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-6 py-4">
        <span className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
          Asistente IA
        </span>

        <div className="flex items-center gap-2">
          {result && (
            <>
              <button
                type="button"
                onClick={requestDiagnosis}
                disabled={isPending}
                title="Volver a solicitar"
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Regenerar
              </button>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <ChevronDown
                  className="w-4 h-4 transition-transform"
                  style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>
            </>
          )}

          {!result && (
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
                  Solicitar diagnóstico
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading state (first request) */}
      {isPending && !result && (
        <div className="px-6 pb-5 flex items-center gap-3 text-sm text-gray-500 border-t border-indigo-100">
          <span className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
          Analizando la incidencia con IA...
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-6 pb-5 border-t border-red-100">
          <p className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        </div>
      )}

      {/* Result */}
      {result && open && !isPending && (
        <div className="px-6 pb-6 border-t border-indigo-100">
          <div className="pt-4 prose prose-sm max-w-none text-gray-700">
            <MarkdownText text={result} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Minimal markdown renderer — bold, headers, lists */
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        if (/^###\s/.test(line)) {
          return <p key={i} className="font-semibold text-gray-900 mt-3">{line.replace(/^###\s/, "")}</p>;
        }
        if (/^##\s/.test(line)) {
          return <p key={i} className="font-bold text-gray-900 text-base mt-4">{line.replace(/^##\s/, "")}</p>;
        }
        if (/^#\s/.test(line)) {
          return <p key={i} className="font-bold text-gray-900 text-lg mt-4">{line.replace(/^#\s/, "")}</p>;
        }
        if (/^\*\*(.+)\*\*$/.test(line)) {
          return <p key={i} className="font-semibold text-gray-800 mt-3">{line.replace(/\*\*/g, "")}</p>;
        }
        if (/^[-*]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-indigo-400 shrink-0">•</span>
              <span>{renderInline(line.replace(/^[-*]\s/, ""))}</span>
            </div>
          );
        }
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2 ml-2">
              <span className="text-indigo-500 font-medium shrink-0 w-4">{num}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "" || line === "---") {
          return <div key={i} className="h-1" />;
        }
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
