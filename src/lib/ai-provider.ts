// Proveedores de IA y cuál se usa por defecto. Separado de `lib/ai` —que carga
// los SDK de OpenAI y Gemini— para que los componentes cliente puedan leer el
// predeterminado sin meter esos SDK en el bundle del navegador.

export type AiProvider = "gemini" | "openai";

/** Proveedor principal de toda la app. Gemini queda como alternativa. */
export const DEFAULT_AI_PROVIDER: AiProvider = "openai";

/** En el orden en que se ofrecen: el principal primero. */
export const AI_PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Gemini" },
];

export function isValidProvider(p: unknown): p is AiProvider {
  return p === "gemini" || p === "openai";
}

/** El proveedor elegido si es válido; si no, el predeterminado. */
export function resolveProvider(p: unknown): AiProvider {
  return isValidProvider(p) ? p : DEFAULT_AI_PROVIDER;
}

/** El otro proveedor, para ofrecer un reintento cuando uno falla. */
export function alternateProvider(p: AiProvider): AiProvider {
  return p === "openai" ? "gemini" : "openai";
}

export function providerLabel(p: AiProvider): string {
  return AI_PROVIDERS.find((o) => o.value === p)?.label ?? p;
}
