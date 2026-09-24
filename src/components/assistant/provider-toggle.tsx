"use client";

import { AI_PROVIDERS as OPTIONS, type AiProvider } from "@/lib/ai-provider";

/** Selector compacto del proveedor de IA (OpenAI / Gemini). OpenAI, el principal, va primero. */
export function ProviderToggle({
  value,
  onChange,
  disabled,
}: {
  value: AiProvider;
  onChange: (p: AiProvider) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50" title="Modelo de IA">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${
            value === o.value ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
