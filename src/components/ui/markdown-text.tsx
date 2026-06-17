import type React from "react";

/** Renderizador ligero de Markdown (encabezados, listas, negritas).
 *  Compartido por el asistente de tickets y el asistente global. */
export function MarkdownText({ text }: { text: string }) {
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
